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

package dynamic.mapping.core.mock;

import com.cumulocity.rest.representation.inventory.ManagedObjectRepresentation;
import org.springframework.stereotype.Service;

@Service
public class MockInventory {

    public ManagedObjectRepresentation create(ManagedObjectRepresentation mor) {
        return null;
    }

    public ManagedObjectRepresentation update(ManagedObjectRepresentation mor) {
        return null;
    }

}
