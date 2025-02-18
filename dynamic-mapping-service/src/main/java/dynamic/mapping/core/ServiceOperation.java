/*
 * Copyright (c) 2022-2025 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 *  @authors Christof Strack, Stefan Witschel
 *
 */

package dynamic.mapping.core;

import java.util.HashMap;
import java.util.Map;

import jakarta.validation.constraints.NotNull;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ServiceOperation {

    private String tenant;
    
    @NotNull
    private Operation operation;

    private Map<String, String> parameter;

    public static ServiceOperation reloadMappings(String tenant) {
        return new ServiceOperation(tenant, Operation.RELOAD_MAPPINGS, null);
    }   
    public static ServiceOperation connect(String tenant, String connectorIdentifier) {
        HashMap<String, String> params = new HashMap<>();
        params.put("connectorIdentifier", connectorIdentifier);
        return new ServiceOperation(tenant, Operation.CONNECT, params);
    }
    public static ServiceOperation reloadExtensions(String tenant) {
        return new ServiceOperation(tenant, Operation.RELOAD_EXTENSIONS, null);
    } 
    public static ServiceOperation refreshNotificationSubscription(String tenant) {
        return new ServiceOperation(tenant, Operation.REFRESH_NOTIFICATIONS_SUBSCRIPTIONS, null);
    }
}
