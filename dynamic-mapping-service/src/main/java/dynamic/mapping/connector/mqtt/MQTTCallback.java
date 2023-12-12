package dynamic.mapping.connector.mqtt;

import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallback;
import org.eclipse.paho.client.mqttv3.MqttMessage;

import dynamic.mapping.connector.core.callback.ConnectorMessage;
import dynamic.mapping.connector.core.callback.GenericMessageCallback;

public class MQTTCallback implements MqttCallback {
    GenericMessageCallback genericMessageCallback;
    String tenant;
    String connectorIdent;

    MQTTCallback(GenericMessageCallback callback, String tenant, String connectorIdent) {
        this.genericMessageCallback = callback;
        this.tenant = tenant;
        this.connectorIdent = connectorIdent;
    }
    @Override
    public void connectionLost(Throwable throwable) {
        genericMessageCallback.onClose(null,throwable);
    }

    @Override
    public void messageArrived(String s, MqttMessage mqttMessage) throws Exception {
        ConnectorMessage connectorMessage = new ConnectorMessage();
        connectorMessage.setPayload(mqttMessage.getPayload());
        genericMessageCallback.onMessage(s,connectorMessage);
    }

    @Override
    public void deliveryComplete(IMqttDeliveryToken iMqttDeliveryToken) {

    }
}
