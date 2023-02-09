/*
 * Copyright (c) 2022 Software AG, Darmstadt, Germany and/or Software AG USA Inc., Reston, VA, USA,
 * and/or its subsidiaries and/or its affiliates and/or their licensors.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @authors Christof Strack, Stefan Witschel
 */

package mqtt.mapping.processor;

import java.io.IOException;
import java.util.AbstractMap;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;
import java.util.regex.Pattern;

import org.apache.commons.lang3.mutable.MutableInt;
import org.json.JSONException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestMethod;

import com.cumulocity.model.ID;
import com.cumulocity.model.idtype.GId;
import com.cumulocity.rest.representation.AbstractExtensibleRepresentation;
import com.cumulocity.rest.representation.identity.ExternalIDRepresentation;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.JsonPath;
import com.jayway.jsonpath.ReadContext;

import lombok.extern.slf4j.Slf4j;
import mqtt.mapping.core.C8YAgent;
import mqtt.mapping.model.API;
import mqtt.mapping.model.Direction;
import mqtt.mapping.model.Mapping;
import mqtt.mapping.model.MappingRepresentation;
import mqtt.mapping.model.MappingSubstitution.SubstituteValue;
import mqtt.mapping.model.MappingSubstitution.SubstituteValue.TYPE;
import mqtt.mapping.processor.model.C8YRequest;
import mqtt.mapping.processor.model.ProcessingContext;
import mqtt.mapping.processor.model.RepairStrategy;
import mqtt.mapping.processor.system.SysHandler;
import mqtt.mapping.service.MQTTClient;

@Slf4j
@Service
public abstract class BasePayloadProcessorOutgoing<T> {

    public BasePayloadProcessorOutgoing(ObjectMapper objectMapper, MQTTClient mqttClient, C8YAgent c8yAgent) {
        this.objectMapper = objectMapper;
        this.mqttClient = mqttClient;
        this.c8yAgent = c8yAgent;
    }

    protected C8YAgent c8yAgent;

    protected ObjectMapper objectMapper;

    protected MQTTClient mqttClient;

    @Autowired
    SysHandler sysHandler;

    public static String TOKEN_DEVICE_TOPIC = "_DEVICE_IDENT_";
    public static String TOKEN_DEVICE_TOPIC_BACKQUOTE = "`_DEVICE_IDENT_`";
    public static String TOKEN_TOPIC_LEVEL = "_TOPIC_LEVEL_";
    public static String TOKEN_TOPIC_LEVEL_BACKQUOTE = "`_TOPIC_LEVEL_`";

    public static final String TIME = "time";

    public abstract ProcessingContext<T> deserializePayload(ProcessingContext<T> context, C8YMessage c8yMessage)
            throws IOException;

    public abstract void extractFromSource(ProcessingContext<T> context) throws ProcessingException;

    public ProcessingContext<T> substituteInTargetAndSend(ProcessingContext<T> context) {
        /*
         * step 3 replace target with extract content from incoming payload
         */
        Mapping mapping = context.getMapping();

        // if there are to little device idenfified then we replicate the first device
        Map<String, List<SubstituteValue>> postProcessingCache = context.getPostProcessingCache();
        String maxEntry = postProcessingCache.entrySet()
                .stream()
                .map(entry -> new AbstractMap.SimpleEntry<String, Integer>(entry.getKey(), entry.getValue().size()))
                .max((Entry<String, Integer> e1, Entry<String, Integer> e2) -> e1.getValue()
                        .compareTo(e2.getValue()))
                .get().getKey();

        // List<SubstituteValue> deviceEntries =
        // postProcessingCache.get(mapping.targetAPI.identifier);
        List<SubstituteValue> deviceEntries = postProcessingCache
                .get(MappingRepresentation.findDeviceIdentifier(mapping).pathTarget);
        int countMaxlistEntries = postProcessingCache.get(maxEntry).size();
        SubstituteValue toDouble = deviceEntries.get(0);
        while (deviceEntries.size() < countMaxlistEntries) {
            deviceEntries.add(toDouble);
        }
        Set<String> pathTargets = postProcessingCache.keySet();

        int i = 0;
        for (SubstituteValue device : deviceEntries) {

            int predecessor = -1;
            JsonNode payloadTarget = null;
            try {
                payloadTarget = objectMapper.readTree(mapping.target);
                /*
                 * step 0 patch payload with dummy property _TOPIC_LEVEL_ in case the content
                 * is required in the payload for a substitution
                 */
                ArrayNode topicLevels = objectMapper.createArrayNode();
                List<String> splitTopicAsList = Mapping.splitTopicExcludingSeparatorAsList(context.getTopic());
                splitTopicAsList.forEach(s -> topicLevels.add(s));
                if (payloadTarget instanceof ObjectNode) {
                    ((ObjectNode) payloadTarget).set(TOKEN_TOPIC_LEVEL, topicLevels);
                } else {
                    log.warn("Parsing this message as JSONArray, no elements from the topic level can be used!");
                }
            } catch (JsonProcessingException e) {
                context.addError(new ProcessingException(e.getMessage()));
                return context;
            }
            for (String pathTarget : pathTargets) {
                SubstituteValue substituteValue = new SubstituteValue(new TextNode("NOT_DEFINED"), TYPE.TEXTUAL,
                        RepairStrategy.DEFAULT);
                if (i < postProcessingCache.get(pathTarget).size()) {
                    substituteValue = postProcessingCache.get(pathTarget).get(i).clone();
                } else if (postProcessingCache.get(pathTarget).size() == 1) {
                    // this is an indication that the substitution is the same for all
                    // events/alarms/measurements/inventory
                    if (substituteValue.repairStrategy.equals(RepairStrategy.USE_FIRST_VALUE_OF_ARRAY) ||
                            substituteValue.repairStrategy.equals(RepairStrategy.DEFAULT)) {
                        substituteValue = postProcessingCache.get(pathTarget).get(0).clone();
                    } else if (substituteValue.repairStrategy.equals(RepairStrategy.USE_LAST_VALUE_OF_ARRAY)) {
                        int last = postProcessingCache.get(pathTarget).size() - 1;
                        substituteValue = postProcessingCache.get(pathTarget).get(last).clone();
                    }
                    log.warn("During the processing of this pathTarget: {} a repair strategy: {} was used.",
                            pathTarget, substituteValue.repairStrategy);
                }

                if (!mapping.targetAPI.equals(API.INVENTORY)) {
                    if (pathTarget.equals(MappingRepresentation.findDeviceIdentifier(mapping).pathTarget)) {
                        ExternalIDRepresentation externalId = c8yAgent.findExternalId(
                                new GId(substituteValue.typedValue().toString()), mapping.externalIdType, context);
                        if (externalId == null && context.isSendPayload()) {
                            throw new RuntimeException("External id " + substituteValue + " for type "
                                    + mapping.externalIdType + " not found!");
                        } else if (externalId == null) {
                            substituteValue.value = null;
                        } else {
                            substituteValue.value = new TextNode(externalId.getExternalId());
                        }
                    }
                    substituteValueInObject(context, substituteValue, payloadTarget, pathTarget);
                    // } else if (!pathTarget.equals(mapping.targetAPI.identifier)) {
                } else if (!pathTarget.equals(MappingRepresentation.findDeviceIdentifier(mapping).pathTarget)) {
                    substituteValueInObject(context, substituteValue, payloadTarget, pathTarget);
                }
            }
            /*
             * step 4 prepare target payload for sending to mqttBroker
             */
            if (!mapping.targetAPI.equals(API.INVENTORY)) {
                JsonNode topicLevelsJsonNode = payloadTarget.get(TOKEN_TOPIC_LEVEL);
                if (topicLevelsJsonNode.isArray()) {
                    // now merge the replaced topic levels
                    MutableInt c = new MutableInt(0);
                    String[] splitTopicAsList = Mapping.splitTopicIncludingSeparatorAsArray(context.getTopic());
                    ArrayNode topicLevels = (ArrayNode) topicLevelsJsonNode;
                    topicLevels.forEach(tl -> {
                        while (c.intValue() < splitTopicAsList.length && ("/".equals(splitTopicAsList[c.intValue()]))) {
                            c.increment();
                        }
                        splitTopicAsList[c.intValue()] = tl.asText();
                    });

                    StringBuffer resolvedPublishTopic = new StringBuffer();
                    for (int d = 0; d < splitTopicAsList.length; d++) {
                        resolvedPublishTopic.append(splitTopicAsList[d]);
                    }
                    context.setResolvedPublishTopic(resolvedPublishTopic.toString());
                } else {
                    context.setResolvedPublishTopic(context.getMapping().getPublishTopic());
                }
                AbstractExtensibleRepresentation attocRequest = null;
                var newPredecessor = context.addRequest(
                        new C8YRequest(predecessor, RequestMethod.POST, device.value.asText(), mapping.externalIdType,
                                payloadTarget.toString(),
                                null, mapping.targetAPI, null));
                try {
                    attocRequest = mqttClient.createMEAO(context);

                    var response = objectMapper.writeValueAsString(attocRequest);
                    context.getCurrentRequest().setResponse(response);
                } catch (Exception e) {
                    context.getCurrentRequest().setError(e);
                }
                predecessor = newPredecessor;
            } else {
                log.warn("Ignoring payload: {}, {}, {}", payloadTarget, mapping.targetAPI,
                        postProcessingCache.size());
            }
            log.debug("Added payload for sending: {}, {}, numberDevices: {}", payloadTarget, mapping.targetAPI,
                    deviceEntries.size());
            i++;
        }
        return context;

    }

    public void substituteValueInObject(ProcessingContext context, SubstituteValue sub, JsonNode jsonObject, String keys) throws JSONException {
        String[] splitKeys = keys.split(Pattern.quote("."));
        boolean subValueEmpty = sub.value == null || sub.value.isEmpty();
        if (sub.repairStrategy.equals(RepairStrategy.REMOVE_IF_MISSING) && subValueEmpty) {
            removeValueFromObect(jsonObject, splitKeys);
        } else {
            if (splitKeys == null) {
                splitKeys = new String[] { keys };
            }
            // substituteValueInObject(sub, jsonObject, splitKeys);
            String jsonIn = jsonObject.toString();
            String jsonOut = JsonPath.parse(jsonIn).set(keys, sub.typedValue()).read("$").toString();
            try {
                jsonObject = objectMapper.readTree(jsonOut);
            } catch (JsonMappingException e) {
                context.addError(new ProcessingException(e.getMessage()));
                log.warn("During the processing of this key: {} an error occured {} .", keys, e.getMessage());
            } catch (JsonProcessingException e) {
                context.addError(new ProcessingException(e.getMessage()));
                log.warn("During the processing of this key: {} an error occured {} .", keys, e.getMessage());
            }
        }
    }

    public JsonNode removeValueFromObect(JsonNode jsonObject, String[] keys) throws JSONException {
        String currentKey = keys[0];

        if (keys.length == 1) {
            return ((ObjectNode) jsonObject).remove(currentKey);
        } else if (!jsonObject.has(currentKey)) {
            throw new JSONException(currentKey + "is not a valid key.");
        }

        JsonNode nestedJsonObjectVal = jsonObject.get(currentKey);
        String[] remainingKeys = Arrays.copyOfRange(keys, 1, keys.length);
        return removeValueFromObect(nestedJsonObjectVal, remainingKeys);
    }

    public JsonNode substituteValueInObject(SubstituteValue sub, JsonNode jsonObject, String[] keys)
            throws JSONException {
        String currentKey = keys[0];

        if (keys.length == 1) {
            return ((ObjectNode) jsonObject).set(currentKey, sub.value);
        } else if (!jsonObject.has(currentKey)) {
            throw new JSONException(currentKey + " is not a valid key.");
        }

        JsonNode nestedJsonObjectVal = jsonObject.get(currentKey);
        String[] remainingKeys = Arrays.copyOfRange(keys, 1, keys.length);
        JsonNode updatedNestedValue = substituteValueInObject(sub, nestedJsonObjectVal, remainingKeys);
        return ((ObjectNode) jsonObject).set(currentKey, updatedNestedValue);
    }

}
