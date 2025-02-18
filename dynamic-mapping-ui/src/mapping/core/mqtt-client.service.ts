/*
 * Copyright (c) 2025 Cumulocity GmbH
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
 * @authors Christof Strack
 */
import { Injectable } from '@angular/core';

import { AlertService } from '@c8y/ngx-components';
import { FacadeIdentityService } from './facade/facade-identity.service';
import { FacadeInventoryService } from './facade/facade-inventory.service';
import { ProcessingContext } from './processor/processor.model';
import { FacadeAlarmService } from './facade/facade-alarm.service';
import { FacadeEventService } from './facade/facade-event.service';
import { FacadeMeasurementService } from './facade/facade-measurement.service';
import { FacadeOperationService } from './facade/facade-operation.service';

@Injectable({ providedIn: 'root' })
export class MQTTClient {
  constructor(
    private inventory: FacadeInventoryService,
    private identity: FacadeIdentityService,
    private event: FacadeEventService,
    private alarm: FacadeAlarmService,
    private measurement: FacadeMeasurementService,
    private operation: FacadeOperationService,
    private alert: AlertService
  ) {}

  async createMEAO(context: ProcessingContext) {
    const result = context.requests[context.requests.length - 1].request;
    return result;
  }
}
