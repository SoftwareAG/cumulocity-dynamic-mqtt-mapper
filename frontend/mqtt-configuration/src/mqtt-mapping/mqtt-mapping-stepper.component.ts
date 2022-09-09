import { CdkStep } from '@angular/cdk/stepper';
import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { AlertService, C8yStepper } from '@c8y/ngx-components';
import { JsonEditorComponent } from '@maaxgr/ang-jsoneditor';
import { API, getSchema, isTemplateTopicUnique, isWildcardTopic, Mapping, MappingSubstitution, normalizeTopic, QOS, SAMPLE_TEMPLATES, SCHEMA_PAYLOAD, SnoopStatus, TOKEN_DEVICE_TOPIC } from "../mqtt-configuration.model";
import { MQTTMappingService } from './mqtt-mapping.service';


@Component({
  selector: 'mqtt-mapping-stepper',
  templateUrl: 'mqtt-mapping-stepper.component.html',
  styleUrls: ['./mqtt-mapping.style.css'],
  encapsulation: ViewEncapsulation.None,
})

export class MQTTMappingStepperComponent implements OnInit {

  @Input() mapping: Mapping;
  @Input() mappings: Mapping[];
  @Input() editMode: boolean;
  @Output() onCancel = new EventEmitter<any>();
  @Output() onCommit = new EventEmitter<Mapping>();

  COLOR_PALETTE = ['#d5f4e6', '#80ced6', '#fefbd8', '#618685', '#ffef96', '#50394c', '#b2b2b2', '#f4e1d2']
  API = API;
  QOS = QOS;
  SnoopStatus = SnoopStatus;
  keys = Object.keys;
  values = Object.values;
  SAMPLE_TEMPLATES = SAMPLE_TEMPLATES;

  paletteCounter: number = 0;
  snoopedTemplateCounter: number = 0;
  isSubstitutionValid: boolean;
  substitutions: string = '';

  pathSource: string = '';
  pathTarget: string = '';
  templateSource: any;
  templateTarget: any;
  dataTesting: any;
  pathSourceMissing: boolean;
  pathTargetMissing: boolean;
  selectionList: any = [];
  definesIdentifier: boolean;

  clicksTarget: []
  clicksSource: []
  editorOptionsSource: any
  editorOptionsTarget: any
  editorOptionsTesting: any
  sourceExpressionResult: string
  sourceExpressionErrorMsg: string = '';
  markedDeviceIdentifier: string = '';

  private setSelectionSource = function (node: any, event: any) {
    if (event.type == "click") {
      if (this.clicksSource == undefined) this.clicksSource = [];
      this.clicksSource.push(Date.now());
      this.clicksSource = this.clicksSource.slice(-2);
      let doubleClick = (this.clicksSource.length > 1 ? this.clicksSource[1] - this.clicksSource[0] : Infinity);
      //console.log("Set target editor event:", event.type, this.clicksTarget, doubleClick);
      var path = "";
      for (let i = 0; i < node.path.length; i++) {
        if (typeof node.path[i] === 'number') {
          path = path.substring(0, path.length - 1);
          path += '[' + node.path[i] + ']';

        } else {
          path += node.path[i];
        }
        if (i !== node.path.length - 1) path += ".";
      }
      for (let item of this.selectionList) {
        //console.log("Reset item:", item);
        item.setAttribute('style', null);
      }
      // test if doubleclicked
      if (doubleClick < 750) {
        this.setSelectionToPath(this.editorSource, path)
        this.updateSourceExpressionResult(path);
        //this.sourceExpression = path;
      }
      //console.log("Set pathSource:", path);
    }
  }.bind(this)


  private setSelectionTarget = function (node: any, event: any) {
    if (event.type == "click") {
      if (this.clicksTarget == undefined) this.clicksTarget = [];
      this.clicksTarget.push(Date.now());
      this.clicksTarget = this.clicksTarget.slice(-2);
      let doubleClick = (this.clicksTarget.length > 1 ? this.clicksTarget[1] - this.clicksTarget[0] : Infinity);
      //console.log("Set target editor event:", event.type, this.clicksTarget, doubleClick);

      var path = "";
      for (let i = 0; i < node.path.length; i++) {
        if (typeof node.path[i] === 'number') {
          path = path.substring(0, path.length - 1);
          path += '[' + node.path[i] + ']';

        } else {
          path += node.path[i];
        }
        if (i !== node.path.length - 1) path += ".";
      }
      for (let item of this.selectionList) {
        //console.log("Reset item:", item);
        item.setAttribute('style', null);
      }
      // test if doubleclicked
      if (doubleClick < 750) {
        this.setSelectionToPath(this.editorTarget, path)
        this.pathTarget = path;
      }
      //console.log("Set pathTarget:", path);
    }
  }.bind(this)


  @ViewChild('editorSource', { static: false }) editorSource!: JsonEditorComponent;
  @ViewChild('editorTarget', { static: false }) editorTarget!: JsonEditorComponent;

  @ViewChild(C8yStepper, { static: false })
  stepper: C8yStepper;

  showConfigMapping: boolean = false;

  isConnectionToMQTTEstablished: boolean;

  selectedSubstitution: number = 0;

  propertyForm: FormGroup;
  testForm: FormGroup;

  topicUnique: boolean = true;
  templateTopicUnique: boolean = true;

  templateTopicValid: boolean = true;

  constructor(
    public mqttMappingService: MQTTMappingService,
    public alertService: AlertService,
    private elementRef: ElementRef,
    private fb: FormBuilder,
  ) { }

  ngOnInit() {
    //console.log("Mapping to be updated:", this.mapping);
    //console.log ("ElementRef:", this.elementRef.nativeElement);
    this.initPropertyForm();
    this.editorOptionsSource = {
      modes: ['tree', 'code'],
      statusBar: false,
      navigationBar: false,
      enableSort: false,
      enableTransform: false,
      enableSearch: false,
      onEvent: this.setSelectionSource,
      schema: SCHEMA_PAYLOAD
    };

    this.editorOptionsTarget = {
      modes: ['tree', 'code'],
      statusBar: false,
      navigationBar: false,
      enableSort: false,
      enableTransform: false,
      enableSearch: false,
      onEvent: this.setSelectionTarget,
      schema: getSchema(this.mapping.targetAPI)
    };

    this.editorOptionsTesting = {
      modes: ['form'],
      statusBar: false,
      navigationBar: false,
      enableSort: false,
      enableTransform: false,
      enableSearch: false,
      onEvent: this.setSelectionSource,
      schema: SCHEMA_PAYLOAD
    };

    this.initTemplateEditors();
    this.initMarkedDeviceIdentifier();

  }

  private initPropertyForm(): void {
    this.propertyForm = this.fb.group({
      targetAPI: new FormControl(this.mapping.targetAPI, Validators.required),
      templateTopic: new FormControl(this.mapping.templateTopic),
      topic: new FormControl(this.mapping.topic, Validators.required),
      active: [this.mapping.active],
      createNoExistingDevice: new FormControl(this.mapping.createNoExistingDevice, Validators.required),
      qos: new FormControl(this.mapping.qos, Validators.required),
      mapDeviceIdentifier: new FormControl(this.mapping.mapDeviceIdentifier),
      externalIdType: new FormControl(this.mapping.externalIdType),
      snoopTemplates: new FormControl(this.mapping.snoopTemplates),
    });

  }

  private setSelectionToPath(editor: JsonEditorComponent, path: string) {
    console.log("Set selection to path:", path);
    const ns = path.split(".");
    const selection = { path: ns };
    editor.setSelection(selection, selection)
  }

  public sourceExpressionChanged(evt) {
    let path = evt.target.value;
    console.log("Evaluate expression:", path, this.editorSource.get());
    this.updateSourceExpressionResult(path);
  }

  private updateSourceExpressionResult(path: string) {
    // JSONPath library
    //this.sourceExpressionResult = JSON.stringify(JSONPath({path: path, json: this.editorSource.get()}), null, 4)
    // JMES library
    //this.sourceExpressionResult = JSON.stringify(search(this.editorSource.get() as any, path), null, 4)
    // JSONATA

    try {
      //var expression = this.JSONATA(path)
      //this.sourceExpressionResult = JSON.stringify(expression.evaluate(this.editorSource.get()), null, 4)
      this.pathSource = path;
      this.sourceExpressionResult = this.mqttMappingService.evaluateExpression(this.editorSource.get(), path);
      this.sourceExpressionErrorMsg = '';
    } catch (error) {
      console.log("Error evaluating expression: ", error);
      this.sourceExpressionErrorMsg = error.message
    }
  }

  checkTopicIsUnique(evt): boolean {
    let topic = evt.target.value;
    console.log("Changed topic: ", topic);
    let result = true;
    result = this.mappings.every(m => {
      if (topic == m.topic && this.mapping.id != m.id) {
        return false;
      } else {
        return true;
      }
    })
    console.log("Check if topic is unique: ", this.mapping, topic, result, this.mappings);
    this.topicUnique = result;
    // invalidate fields, since entry is not valid
    if (!result) this.propertyForm.controls['topic'].setErrors({ 'incorrect': true });
    return result;
  }

  onTopicChanged(evt) {
    let topic = normalizeTopic(this.propertyForm.get('topic').value);
    console.log ("Changed topic:", evt.target.value, topic);
    this.propertyForm.patchValue({ "templateTopic": topic });
    this.mapping.substitutions = [];
  }

  checkTemplateTopicIsValid(evt): boolean {
    let templateTopic = evt.target.value;
    console.log("Changed templateTopic: ", templateTopic);
    let result1 = this.checkTemplateTopicIsUnique(evt)

    let topic = normalizeTopic(this.propertyForm.get('topic').value);
    let result2 = templateTopic.startsWith(topic);
    console.log("Check if topic is substring of templateTopic:", this.mapping, templateTopic, result2, this.mappings);
    this.templateTopicValid = result2;
    // invalidate fields, since entry is not valid
    if (!result2) this.propertyForm.controls['templateTopic'].setErrors({ 'incorrect': true });
    return result2;
  }

  checkTemplateTopicIsUnique(evt): boolean {
    let templateTopic = evt.target.value;
    //console.log("Changed templateTopic: ", templateTopic);
    let result = isTemplateTopicUnique(templateTopic, this.mapping.id, this.mappings);
    console.log("Check if templateTopic is unique: ", this.mapping, templateTopic, result, this.mappings);
    this.templateTopicUnique = result;

    // invalidate fields, since entry is not valid
    if (!result) this.propertyForm.controls['templateTopic'].setErrors({ 'incorrect': true });
    return result;
  }

  private getCurrentMapping(): Mapping {
    //remove dummy field "DEVICE_IDENT", since it should not be stored
    let dts = this.editorSource.get()
    delete dts[TOKEN_DEVICE_TOPIC];
    let st = JSON.stringify(dts);

    let dtt = this.editorSource.get()
    delete dtt[TOKEN_DEVICE_TOPIC];
    let tt = JSON.stringify(dtt);

    return {
      id: this.mapping.id,
      topic: normalizeTopic(this.propertyForm.get('topic').value),
      templateTopic: normalizeTopic(this.propertyForm.get('templateTopic').value),
      indexDeviceIdentifierInTemplateTopic: this.mapping.indexDeviceIdentifierInTemplateTopic,
      targetAPI: this.propertyForm.get('targetAPI').value,
      source: st,
      target: tt,
      active: this.propertyForm.get('active').value,
      tested: this.mapping.tested || false,
      createNoExistingDevice: this.propertyForm.get('createNoExistingDevice').value || false,
      qos: this.propertyForm.get('qos').value,
      substitutions: this.mapping.substitutions,
      mapDeviceIdentifier: this.propertyForm.get('mapDeviceIdentifier').value,
      externalIdType: this.propertyForm.get('externalIdType').value,
      snoopTemplates: this.propertyForm.get('snoopTemplates').value,
      snoopedTemplates: this.mapping.snoopedTemplates,
      lastUpdate: Date.now(),
    };
  }

  async onCommitButton() {
    this.onCommit.emit(this.getCurrentMapping());
  }

  async onTestTransformation() {
    let dataTesting = await this.mqttMappingService.testResult(this.getCurrentMapping(), false);
    this.dataTesting = dataTesting;
  }

  async onSendTest() {
    let { data, res } = await this.mqttMappingService.sendTestResult(this.getCurrentMapping());
    //console.log ("My data:", data );
    if (res.status == 200 || res.status == 201) {
      this.alertService.success("Successfully tested mapping!");
      this.mapping.tested = true;
      this.dataTesting = data as any;
    } else {
      let error = await res.text();
      this.alertService.danger("Failed to tested mapping: " + error);
    }
  }

  onMarkDeviceIdentifier() {
    let parts: string[] = this.propertyForm.get('templateTopic').value.split("/");
    if (this.mapping.indexDeviceIdentifierInTemplateTopic < parts.length - 1) {
      this.mapping.indexDeviceIdentifierInTemplateTopic++;
    } else {
      this.mapping.indexDeviceIdentifierInTemplateTopic = 0;
    }
    this.markedDeviceIdentifier = parts[this.mapping.indexDeviceIdentifierInTemplateTopic];
  }

  private initMarkedDeviceIdentifier() {
    let parts: string[] = this.propertyForm.get('templateTopic').value.split("/");
    if (this.mapping.indexDeviceIdentifierInTemplateTopic < parts.length && this.mapping.indexDeviceIdentifierInTemplateTopic != -1) {
      this.markedDeviceIdentifier = parts[this.mapping.indexDeviceIdentifierInTemplateTopic];
    }
  }

  async onSampleButton() {
    this.templateTarget = JSON.parse(SAMPLE_TEMPLATES[this.propertyForm.get('targetAPI').value]);
  }

  async onCancelButton() {
    this.onCancel.emit();
  }

  public onNextSelected(event: { stepper: C8yStepper; step: CdkStep }): void {
    const targetAPI = this.propertyForm.get('targetAPI').value
    const topic: string = this.propertyForm.get('topic').value;
    console.log("OnNextSelected", event.step.label, targetAPI, this.editMode)

    if (event.step.label == "Define topic") {
      this.substitutions = '';
      console.log("Populate jsonPath if wildcard:", isWildcardTopic(topic), this.mapping.substitutions.length)
      console.log("Templates from mapping:", this.mapping.target, this.mapping.source)
      this.updateSubstitutions();

      this.initTemplateEditors();
      this.editorTarget.setSchema(getSchema(targetAPI), null);

    } else if (event.step.label == "Define templates") {
      console.log("Templates source from editor:", this.templateSource, this.editorSource.getText(), this.getCurrentMapping())
      this.dataTesting = this.editorSource.get();
    } else if (event.step.label == "Test mapping") {

    }
    if (this.propertyForm.get('snoopTemplates').value == SnoopStatus.ENABLED && this.mapping.snoopedTemplates.length == 0) {
      console.log("Ready to snoop ...");
      this.onCommit.emit(this.getCurrentMapping());
    } else {
      event.stepper.next();
    }

  }

  private updateSubstitutions() {
    this.substitutions = ''
    const topic = this.propertyForm.get('topic').value
    if (this.mapping.substitutions.length == 0 && isWildcardTopic(topic)) {
      this.mapping.substitutions.push(
        { pathSource: TOKEN_DEVICE_TOPIC, pathTarget: "source.id", definesIdentifier: true })
        ;
    }
    this.mapping.substitutions.forEach(s => {
      //console.log ("New mapping:", s.pathSource, s.pathTarget);
      let marksDeviceIdentifier = (s.definesIdentifier ? "* " : "");
      this.substitutions = this.substitutions + `[ ${marksDeviceIdentifier}${s.pathSource} -> ${s.pathTarget} ]`;
    });
  }

  private addSubstitution(sub: MappingSubstitution) {
    if (sub.pathTarget = "source.id") {
      sub.definesIdentifier = true;
    }
    this.mapping.substitutions.forEach( s => {
      if (sub.definesIdentifier && s.definesIdentifier) s.definesIdentifier = false;
    })
    this.mapping.substitutions.push(sub);
    this.updateSubstitutions();
  }

  private initTemplateEditors() {
    const targetAPI = this.propertyForm.get('targetAPI').value
    const topic: string = this.propertyForm.get('topic').value;
    this.templateSource = JSON.parse(this.mapping.source);
    //add dummy field TOKEN_DEVICE_TOPIC to use for mapping the device identifier form the topic ending
    if (isWildcardTopic(topic)) {
      this.templateSource = {
        ...this.templateSource,
        DEVICE_IDENT: "909090"
      };
    }
    this.templateTarget = JSON.parse(this.mapping.target);
    if (!this.editMode) {
      this.templateTarget = JSON.parse(SAMPLE_TEMPLATES[targetAPI]);
      console.log("Sample template", this.templateTarget, getSchema(targetAPI));
    }
    if (targetAPI == API.INVENTORY) {
      this.templateTarget = {
        ...this.templateTarget,
        DEVICE_IDENT: "909090"
      };
    }
  }

  async onSnoopedSourceTemplates() {
    if (this.snoopedTemplateCounter >= this.mapping.snoopedTemplates.length) {
      this.snoopedTemplateCounter = 0;
    }
    this.templateSource = JSON.parse(this.mapping.snoopedTemplates[this.snoopedTemplateCounter]);
    const topic: string = this.propertyForm.get('topic').value;
    //add dummy field "DEVICE_IDENT" to use for mapping the device identifier form the topic ending
    if (isWildcardTopic(topic)) {
      this.templateSource = {
        ...this.templateSource,
        DEVICE_IDENT: "909090"
      };
    }
    // disable further snooping for this template
    this.propertyForm.patchValue({ "snoopTemplates": SnoopStatus.STOPPED });
    this.snoopedTemplateCounter++;
  }

  public onAddSubstitutions() {
    this.pathSourceMissing = this.pathSource != '' ? false : true;
    this.pathTargetMissing = this.pathTarget != '' ? false : true;

    if (!this.pathSourceMissing && !this.pathTargetMissing) {
      let sub: MappingSubstitution = {
        pathSource: this.pathSource,
        pathTarget: this.pathTarget,
        definesIdentifier: this.definesIdentifier
      }
      this.addSubstitution(sub);
      console.log("New substitution", sub);
      this.pathSource = '';
      this.pathTarget = '';
      this.pathSourceMissing = true;
      this.pathTargetMissing = true;
    }
  }

  public onDeleteSubstitutions() {
    this.mapping.substitutions = [];
    const topic: string = this.propertyForm.get('topic').value;
    this.substitutions = "";
    if (this.mapping.substitutions.length == 0 && isWildcardTopic(topic)) {
      let sub: MappingSubstitution = {
        pathSource: TOKEN_DEVICE_TOPIC,
        pathTarget: "source.id",
        definesIdentifier: true
      }
      this.addSubstitution(sub);
    }
    console.log("Cleared substitutions!");
  }

  public onDeleteSubstitution() {
    console.log("Delete marked substitution", this.selectedSubstitution);
    if (this.selectedSubstitution < this.mapping.substitutions.length) {
      this.mapping.substitutions.splice(this.selectedSubstitution-1,1);
      this.selectedSubstitution = 0;
    }
    this.updateSubstitutions();
  }

  public onSelectSubstitution() {
    let nextColor = this.COLOR_PALETTE[this.paletteCounter];
    this.paletteCounter++;
    if (this.paletteCounter >= this.COLOR_PALETTE.length) {
      this.paletteCounter = 0;
    }
    if (this.selectedSubstitution < this.mapping.substitutions.length) {
      // reset background color of old selection list
      for (let item of this.selectionList) {
        item.setAttribute('style', null);
      }
      this.updateSourceExpressionResult(this.mapping.substitutions[this.selectedSubstitution].pathSource);
      this.pathTarget = this.mapping.substitutions[this.selectedSubstitution].pathTarget;
      this.definesIdentifier = this.mapping.substitutions[this.selectedSubstitution].definesIdentifier;
      this.setSelectionToPath(this.editorSource, this.mapping.substitutions[this.selectedSubstitution].pathSource)
      this.setSelectionToPath(this.editorTarget, this.mapping.substitutions[this.selectedSubstitution].pathTarget)
      console.log("Found querySelectorAll elements:", this.elementRef.nativeElement.querySelectorAll('.jsoneditor-selected'))
      //this.selectionList  = this.elementRef.nativeElement.getElementsByClassName('jsoneditor-selected');
      this.selectionList = this.elementRef.nativeElement.querySelectorAll('.jsoneditor-selected');
      for (let item of this.selectionList) {
        item.setAttribute('style', `background: ${nextColor};`);
      }
      this.selectedSubstitution++;
    }

    if (this.selectedSubstitution >= this.mapping.substitutions.length) {
      this.selectedSubstitution = 0;
      this.paletteCounter = 0;
    }
    console.log("Show substitutions!");
  }

}
