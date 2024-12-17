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

package dynamic.mapping.model;

import com.fasterxml.jackson.annotation.JsonSetter;
import com.fasterxml.jackson.annotation.Nulls;
import com.jayway.jsonpath.JsonPath;
import com.jayway.jsonpath.internal.JsonFormatter;

import lombok.Getter;
import lombok.ToString;
import dynamic.mapping.processor.model.RepairStrategy;

import jakarta.validation.constraints.NotNull;
import java.io.Serializable;
import java.util.Collection;
import java.util.Map;

@Getter
@ToString()
public class MappingSubstitution implements Serializable {

    public static class SubstituteValue implements Cloneable {
        public static enum TYPE {
            ARRAY,
            IGNORE,
            NUMBER,
            OBJECT,
            TEXTUAL,
        }

        public Object value;
        public TYPE type;
        public RepairStrategy repairStrategy;

        public SubstituteValue(Object value, TYPE type, RepairStrategy repair) {
            this.type = type;
            this.value = value;
            this.repairStrategy = repair;
        }

        @Override
        public SubstituteValue clone() {
            return new SubstituteValue(this.value, this.type, this.repairStrategy);
        }
    }

    public MappingSubstitution() {
        this.repairStrategy = RepairStrategy.DEFAULT;
        this.expandArray = false;
    }

    @NotNull
    public String pathSource;

    @NotNull
    public String pathTarget;

    @NotNull
    @JsonSetter(nulls = Nulls.SKIP)
    public RepairStrategy repairStrategy;

    @JsonSetter(nulls = Nulls.SKIP)
    public boolean definesDeviceIdentifier(API api, String externalIdType, Direction direction,
            MappingSubstitution sub) {
        if (Direction.INBOUND.equals(direction)) {
            if (externalIdType != null && !("").equals(externalIdType)) {
                return (Mapping.IDENTITY + ".externalId").equals(sub.pathTarget);
            } else {
                return (Mapping.IDENTITY + ".c8ySourceId").equals(sub.pathTarget);
            }
        } else {
            if (externalIdType != null && !("").equals(externalIdType)) {
                return (Mapping.IDENTITY + ".externalId").equals(sub.pathSource);
            } else {
                return (Mapping.IDENTITY + ".c8ySourceId").equals(sub.pathSource);
            }
        }
    }

    @JsonSetter(nulls = Nulls.SKIP)
    public boolean expandArray;

    public static Boolean isArray(Object obj) {
        return obj != null && obj instanceof Collection;
    }

    public static Boolean isObject(Object obj) {
        return obj != null && obj instanceof Map;
    }

    public static Boolean isTextual(Object obj) {
        return obj != null && obj instanceof String;
    }

    public static Boolean isNumber(Object obj) {
        return obj != null && obj instanceof Number;
    }

    public static Boolean isBoolean(Object obj) {
        return obj != null && obj instanceof Boolean;
    }

    public static String toPrettyJsonString(Object obj) {
        if (obj == null) {
            return null;
        } else if (obj instanceof Map || obj instanceof Collection) {
            return JsonFormatter.prettyPrint(JsonPath.parse(obj).jsonString());
        } else {
            return obj.toString();
        }
    }

    public static String toJsonString(Object obj) {
        if (obj == null) {
            return null;
        } else if (obj instanceof Map || obj instanceof Collection) {
            return JsonPath.parse(obj).jsonString();
        } else {
            return obj.toString();
        }
    }

}
