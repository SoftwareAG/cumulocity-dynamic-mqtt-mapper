package dynamic.mapping.core;

import java.util.List;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;

import dynamic.mapping.configuration.ServiceConfiguration;
import dynamic.mapping.configuration.ServiceConfigurationComponent;
import dynamic.mapping.connector.core.client.AConnectorClient;
import dynamic.mapping.connector.core.registry.ConnectorRegistry;
import dynamic.mapping.connector.core.registry.ConnectorRegistryException;
import dynamic.mapping.model.MappingServiceRepresentation;
import dynamic.mapping.processor.PayloadProcessor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.stereotype.Service;

import com.cumulocity.microservice.context.credentials.Credentials;
import com.cumulocity.microservice.context.credentials.MicroserviceCredentials;
import com.cumulocity.microservice.subscription.model.MicroserviceSubscriptionAddedEvent;
import com.cumulocity.microservice.subscription.model.MicroserviceSubscriptionRemovedEvent;
import com.cumulocity.rest.representation.inventory.ManagedObjectRepresentation;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import dynamic.mapping.configuration.ConnectorConfiguration;
import dynamic.mapping.configuration.ConnectorConfigurationComponent;
import dynamic.mapping.connector.mqtt.MQTTClient;

@Service
@EnableScheduling
@Slf4j
public class BootstrapService {

    @Autowired
    ConnectorRegistry connectorRegistry;

    @Autowired
    C8YAgent c8YAgent;

    @Autowired
    private MappingComponent mappingComponent;

    @Autowired
    ServiceConfigurationComponent serviceConfigurationComponent;

    private Map<String, MappingServiceRepresentation> mappingServiceRepresentations;

    @Autowired
    public void setMappingServiceRepresentations(
            Map<String, MappingServiceRepresentation> mappingServiceRepresentations) {
        this.mappingServiceRepresentations = mappingServiceRepresentations;
    }

    @Getter
    public Map<String, ServiceConfiguration> serviceConfigurations;

    @Autowired
    public void setServiceConfigurations(Map<String, ServiceConfiguration> serviceConfigurations) {
        this.serviceConfigurations = serviceConfigurations;
    }

    @Autowired
    ConnectorConfigurationComponent connectorConfigurationComponent;

    private ObjectMapper objectMapper;

    @Autowired
    public void setObjectMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Qualifier("cachedThreadPool")
    private ExecutorService cachedThreadPool;

    @Autowired
    public void setCachedThreadPool(ExecutorService cachedThreadPool) {
        this.cachedThreadPool = cachedThreadPool;
    }

    @Value("${APP.additionalSubscriptionIdTest}")
    private String additionalSubscriptionIdTest;

    @EventListener
    public void destroy(MicroserviceSubscriptionRemovedEvent event) {
        log.info("Tenant {} - Microservice unsubscribed", event.getTenant());
        String tenant = event.getTenant();
        c8YAgent.getNotificationSubscriber().disconnect(tenant, false);
        c8YAgent.getNotificationSubscriber().deleteAllSubscriptions(tenant);

        try {
            connectorRegistry.unregisterAllClientsForTenant(tenant);
        } catch (ConnectorRegistryException e) {
            log.error("Error on cleaning up connector clients");
        }
    }

    @EventListener
    public void initialize(MicroserviceSubscriptionAddedEvent event) {
        // Executed for each tenant subscribed
        String tenant = event.getCredentials().getTenant();
        log.info("Tenant {} - Microservice subscribed", tenant);
        TimeZone.setDefault(TimeZone.getTimeZone("Europe/Berlin"));
        ManagedObjectRepresentation mappingServiceMOR = c8YAgent.createMappingServiceObject(tenant);
        PayloadProcessor processor = new PayloadProcessor(objectMapper, c8YAgent, tenant, null);
        c8YAgent.checkExtensions(tenant, processor);
        ServiceConfiguration serviceConfiguration = serviceConfigurationComponent.loadServiceConfiguration();
        serviceConfigurations.put(tenant, serviceConfiguration);
        c8YAgent.loadProcessorExtensions(tenant);
        MappingServiceRepresentation mappingServiceRepresentation = objectMapper.convertValue(mappingServiceMOR,
                MappingServiceRepresentation.class);
        mappingServiceRepresentations.put(tenant, mappingServiceRepresentation);
        mappingComponent.initializeMappingStatus(tenant, false);
        // TODO Add other clients static property definition here
        connectorRegistry.registerConnector(MQTTClient.getConnectorType(), MQTTClient.getSpec());

        try {
            if (serviceConfiguration != null) {
                List<ConnectorConfiguration> connectorConfigurationList = connectorConfigurationComponent
                        .getConnectorConfigurations(tenant);
                // For each connector configuration create a new instance of the connector
                for (ConnectorConfiguration connectorConfiguration : connectorConfigurationList) {
                    initializeConnectorByConfiguration(connectorConfiguration, serviceConfiguration,
                            tenant);
                }
            }

        } catch (Exception e) {
            log.error("Error on initializing connectors: ", e);
            // mqttClient.submitConnect();
        }
    }

    public AConnectorClient initializeConnectorByConfiguration(ConnectorConfiguration connectorConfiguration,
            ServiceConfiguration serviceConfiguration, String tenant) throws ConnectorRegistryException {
        AConnectorClient client = null;

        if (MQTTClient.getConnectorType().equals(connectorConfiguration.getConnectorType())) {
            log.info("Tenant {} - Initializing MQTT Connector with ident {}", tenant,
                    connectorConfiguration.getIdent());
            MQTTClient mqttClient = new MQTTClient(tenant, mappingComponent,
                    connectorConfigurationComponent, connectorConfiguration, c8YAgent, cachedThreadPool, objectMapper,
                    additionalSubscriptionIdTest, mappingServiceRepresentations.get(tenant), serviceConfiguration);
            connectorRegistry.registerClient(tenant, mqttClient);
            mqttClient.reconnect();
            mqttClient.submitHouskeeping();
            client = mqttClient;
        }
        // Subscriber must be new initialized for the new added connector
        c8YAgent.notificationSubscriberReconnect(tenant);
        return client;
    }

    public void shutdownConnector(String tenant, String ident) throws ConnectorRegistryException {
        connectorRegistry.unregisterClient(tenant, ident);
        c8YAgent.getNotificationSubscriber().removeConnector(tenant, ident);
    }
}
