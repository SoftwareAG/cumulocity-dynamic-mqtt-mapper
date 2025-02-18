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
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewEncapsulation
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { AlertService } from '@c8y/ngx-components';
import { FormlyConfig, FormlyFieldConfig } from '@ngx-formly/core';
import { BehaviorSubject } from 'rxjs';
import { MappingService } from '../core/mapping.service';
import { EditorMode } from '../shared/stepper.model';
import { ValidationError } from '../shared/mapping.model';
import { deriveSampleTopicFromTopic } from '../shared/util';
import { SharedService, StepperConfiguration, API, Direction, Mapping, QOS, SnoopStatus, FormatStringPipe } from '../../shared';

@Component({
  selector: 'd11r-mapping-properties',
  templateUrl: 'mapping-properties.component.html',
  styleUrls: ['../shared/mapping.style.css'],
  encapsulation: ViewEncapsulation.None
})
export class MappingStepPropertiesComponent
  implements OnInit, OnChanges, OnDestroy {
  @Input() mapping: Mapping;
  @Input() supportsMessageContext: boolean;

  @Input() stepperConfiguration: StepperConfiguration;
  @Input() propertyFormly: FormGroup;

  @Output() targetAPIChanged = new EventEmitter<any>();
  @Output() snoopStatusChanged = new EventEmitter<SnoopStatus>();

  ValidationError = ValidationError;
  Direction = Direction;
  EditorMode = EditorMode;

  propertyFormlyFields: FormlyFieldConfig[] = [];
  selectedResult$: BehaviorSubject<number> = new BehaviorSubject<number>(0);
  sourceSystem: string;
  targetSystem: string;

  constructor(
    mappingService: MappingService,
    sharedService: SharedService,
    private alertService: AlertService,
    private configService: FormlyConfig,
    private formatStringPipe: FormatStringPipe
  ) { }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['supportsMessageContext']) {
      this.supportsMessageContext =
        changes['supportsMessageContext'].currentValue;
      this.propertyFormlyFields = [...this.propertyFormlyFields];
      // console.log('Changes', changes);
    }
  }

  ngOnInit() {
    // set value for backward compatibility
    if (!this.mapping.direction) this.mapping.direction = Direction.INBOUND;
    this.targetSystem =
      this.mapping.direction == Direction.INBOUND ? 'Cumulocity' : 'Broker';
    this.sourceSystem =
      this.mapping.direction == Direction.OUTBOUND ? 'Cumulocity' : 'Broker';
    // console.log(
    //  'Mapping to be updated:',
    //  this.mapping,
    //  this.stepperConfiguration
    // );
    // const numberSnooped = this.mapping.snoopedTemplates
    //   ? this.mapping.snoopedTemplates.length
    //   : 0;
    // if (this.mapping.snoopStatus == SnoopStatus.STARTED && numberSnooped > 0) {
    //   this.alertService.success(
    //     `Already ${numberSnooped} templates exist. To stop the snooping process click on Cancel, select the respective mapping in the list of all mappings and choose the action Toggle Snooping.`,
    //     `The recording process is in state ${this.mapping.snoopStatus}.`
    //   );
    // }
    this.propertyFormlyFields = [
      {
        validators: {
          validation: [
            this.stepperConfiguration.direction == Direction.INBOUND
              ? 'checkTopicsInboundAreValid'
              : 'checkTopicsOutboundAreValid'
          ]
        },
        fieldGroupClassName: 'row',
        fieldGroup: [
          {
            className: 'col-lg-6',
            key: 'name',
            wrappers: ['c8y-form-field'],
            type: 'input',
            templateOptions: {
              label: 'Mapping Name',
              disabled:
                this.stepperConfiguration.editorMode == EditorMode.READ_ONLY,
              required: true
            }
          },
          {
            className: 'col-lg-6',
            key: 'mappingTopic',
            wrappers: ['c8y-form-field'],
            type: 'input',
            templateOptions: {
              label: 'Mapping Topic',
              placeholder: 'The MappingTopic defines a key to which this mapping is bound. It is a kind of key to organize the mappings internally',
              disabled:
                this.stepperConfiguration.editorMode == EditorMode.READ_ONLY,
              description: 'Mapping Topic',
              change: () => {
                const newDerivedTopic = deriveSampleTopicFromTopic(
                  this.propertyFormly.get('mappingTopic').value
                );
                if (this.stepperConfiguration.direction == Direction.INBOUND) {
                  this.propertyFormly
                    .get('mappingTopicSample')
                    .setValue(newDerivedTopic);
                } else {
                  this.propertyFormly
                    .get('publishTopicSample')
                    .setValue(newDerivedTopic);
                }
              },
              required: this.stepperConfiguration.direction == Direction.INBOUND
            },
            hideExpression:
              this.stepperConfiguration.direction == Direction.OUTBOUND
          },
          {
            className: 'col-lg-6',
            key: 'publishTopic',
            wrappers: ['c8y-form-field'],
            type: 'input',
            templateOptions: {
              label: 'Publish Topic',
              placeholder: 'Publish Topic ...',
              disabled:
                this.stepperConfiguration.editorMode == EditorMode.READ_ONLY,
              change: () => {
                const newDerivedTopic = deriveSampleTopicFromTopic(
                  this.propertyFormly.get('publishTopic').value
                );
                this.propertyFormly
                  .get('publishTopicSample')
                  .setValue(newDerivedTopic);
              },
              required:
                this.stepperConfiguration.direction == Direction.OUTBOUND
            },
            hideExpression:
              this.stepperConfiguration.direction != Direction.OUTBOUND
          },
          {
            className: 'col-lg-6',
            key: 'filterMapping',
            type: 'input',
            templateOptions: {
              label: 'Filter Mapping',
              placeholder: 'e.g. custom_OperationFragment',
              disabled:
                this.stepperConfiguration.editorMode == EditorMode.READ_ONLY,
              description:
                'The Filter Mapping can contain one fragment name to associate a mapping to a Cumulocity MEAO. If the Cumulocity MEAO contains this fragment, the mapping is applied. Specify nested elements as follows: custom_OperationFragment.value',
              required:
                this.stepperConfiguration.direction == Direction.OUTBOUND
            },
            hideExpression:
              this.stepperConfiguration.direction != Direction.OUTBOUND
          },
          {
            className: 'col-lg-6',
            key: 'mappingTopicSample',
            type: 'input',
            wrappers: ['c8y-form-field'],
            templateOptions: {
              label: 'Mapping Topic Sample',
              placeholder: 'e.g. device/110',
              disabled:
                this.stepperConfiguration.editorMode == EditorMode.READ_ONLY,
              description: `The MappingTopicSample name
              must have the same structure and number of
              levels as the MappingTopic. Wildcards, i.e. "+" in the MappingTopic are replaced with concrete runtime values. This helps to identify the relevant positions in the substitutions`,
              required: true
            },
            hideExpression:
              this.stepperConfiguration.direction == Direction.OUTBOUND
          },
          {
            className: 'col-lg-6',
            key: 'publishTopicSample',
            type: 'input',
            wrappers: ['c8y-form-field'],
            templateOptions: {
              label: 'Publish Topic Sample',
              placeholder: 'e.g. device/110',
              disabled:
                this.stepperConfiguration.editorMode == EditorMode.READ_ONLY,
              description: `The PublishTopicSample name
              must have the same structure and number of
              levels as the PublishTopic. Wildcards, i.e. "+" in the PublishTopic are replaced with concrete runtime values. This helps to identify the relevant positions in the substitutions`,
              required: true
            },
            hideExpression:
              this.stepperConfiguration.direction != Direction.OUTBOUND
          }
        ]
      },
      {  
        type: 'template',
        template: '<div class="legend form-block col-xs-12">Properties</div>'
      },
      {
        fieldGroupClassName: 'row',
        fieldGroup: [
          {
            className: 'col-lg-3',
            key: 'targetAPI',
            type: 'select',
            wrappers: ['c8y-form-field'],
            templateOptions: {
              label: 'Target API',
              options: Object.keys(API)
                .filter((key) => key != API.ALL.name)
                .map((key) => {
                  return { label: this.formatStringPipe.transform(key), value: key };
                }),
              disabled:
                this.stepperConfiguration.editorMode == EditorMode.READ_ONLY,
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              change: (field: FormlyFieldConfig, event?: any) => {
                // console.log(
                //  'Changes:',
                //  field,
                //  event,
                //  this.mapping,
                //  this.propertyFormly.valid
                // );
                this.onTargetAPIChanged(
                  this.propertyFormly.get('targetAPI').value
                );
              },
              required: true
            }
          },
          {
            className: 'col-lg-3',
            key: 'createNonExistingDevice',
            type: 'switch',
            wrappers: ['custom-form-field-wrapper'],
            templateOptions: {
              label: 'Create device',
              disabled:
                this.stepperConfiguration.editorMode == EditorMode.READ_ONLY,
              description:
                'In case a MEAO (Measuremente, Event, Alarm, Operation) is received and the referenced device does not yet exist, it can be created automatically.',
              required: false,
              switchMode: true,
              indeterminate: false,
              hideLabel: true
            },
            hideExpression: () =>
              this.stepperConfiguration.direction == Direction.OUTBOUND ||
              this.mapping.targetAPI == API.INVENTORY.name
          },
          {
            className: 'col-lg-3',
            key: 'updateExistingDevice',
            type: 'switch',
            wrappers: ['custom-form-field-wrapper'],
            templateOptions: {
              label: 'Update Existing Device',
              disabled:
                this.stepperConfiguration.editorMode == EditorMode.READ_ONLY,
              description: 'Update Existing Device.',
              required: false,
              switchMode: true,
              indeterminate: false,
              hideLabel: true
            },
            hideExpression: () =>
              this.stepperConfiguration.direction == Direction.OUTBOUND ||
              (this.stepperConfiguration.direction == Direction.INBOUND &&
                this.mapping.targetAPI != API.INVENTORY.name)
          },
          {
            className: 'col-lg-3',
            key: 'autoAckOperation',
            type: 'switch',
            wrappers: ['custom-form-field-wrapper'],
            templateOptions: {
              label: 'Auto acknowledge',
              disabled:
                this.stepperConfiguration.editorMode == EditorMode.READ_ONLY,
              description: 'Auto acknowledge outbound operation.',
              required: false,
              switchMode: true,
              indeterminate: false,
              hideLabel: true
            },
            hideExpression: () =>
              this.stepperConfiguration.direction == Direction.INBOUND ||
              (this.stepperConfiguration.direction == Direction.OUTBOUND &&
                this.mapping.targetAPI != API.OPERATION.name)
          },
          // filler
          {
            className: 'col-lg-3',
            template: '<div class="form-group row" style="height:80px"></div>',
            hideExpression: () =>
              this.stepperConfiguration.direction == Direction.INBOUND ||
              (this.stepperConfiguration.direction == Direction.OUTBOUND &&
                this.mapping.targetAPI == API.OPERATION.name)
          },
          {
            className: 'col-lg-6',
            key: 'qos',
            type: 'select',
            wrappers: ['c8y-form-field'],
            templateOptions: {
              label: 'QOS',
              options: Object.values(QOS).map((key) => {
                return { label: this.formatStringPipe.transform(key), value: key };
              }),
              disabled:
                this.stepperConfiguration.editorMode == EditorMode.READ_ONLY,
              required: true
            }
          }
        ]
      },
      {
        fieldGroupClassName: 'row',
        fieldGroup: [
          {
            className: 'col-lg-3',
            key: 'useExternalId',
            type: 'switch',
            wrappers: ['custom-form-field-wrapper'],
            templateOptions: {
              label: 'Use external id',
              switchMode: true,
              disabled:
                this.stepperConfiguration.editorMode == EditorMode.READ_ONLY,
              description:
                'If this is enabled then the device id is identified by its  external id which is looked up and translated using the externalIdType.',
              indeterminate: false,
              hideLabel: true
            }
          },
          {
            className: 'col-lg-3',
            key: 'externalIdType',
            type: 'input',
            defaultValue: 'c8y_Serial',
            templateOptions: {
              label: 'External Id type',
              disabled:
                this.stepperConfiguration.editorMode == EditorMode.READ_ONLY
            },
            hideExpression: (model) => !model.useExternalId
          },
          // filler
          {
            className: 'col-lg-3',
            template: '<div class="form-group row" style="height:80px"></div>',
            hideExpression: (model) => model.useExternalId
          },
          {
            className: 'col-lg-6',
            template: '<div class="form-group row" style="height:80px"></div>'
          }
        ]
      },
      {
        fieldGroupClassName: 'row',
        fieldGroup: [
          {
            className: 'col-lg-6',
            key: 'supportsMessageContext',
            type: 'switch',
            wrappers: ['custom-form-field-wrapper'],
            templateOptions: {
              switchMode: true,
              label: 'Use message context',
              disabled:
                this.stepperConfiguration.editorMode == EditorMode.READ_ONLY,
              description:
                'Supports key from message context, e.g. partition keys for Kafka. This property only applies to certain connectors.',
              hideLabel: true
            },
            hideExpression: () => !this.supportsMessageContext
          }
        ]
      }
    ];
  }

  onTargetAPIChanged(targetAPI) {
    this.mapping.targetAPI = targetAPI;
    this.targetAPIChanged.emit(targetAPI);
  }

  ngOnDestroy() {
    this.selectedResult$.complete();
  }
}
