import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  CoreModule,
  HOOK_NAVIGATOR_NODES,
  HOOK_ROUTE,
  HOOK_TABS,
  HOOK_WIZARD,
  Route
} from '@c8y/ngx-components';
import { BokerConfigurationComponent } from './mqtt-configuration/broker-configuration.component';
import { ConfigurationModule } from './mqtt-configuration/configuration.module';
import { MappingTreeComponent } from './mqtt-mapping-tree/tree.component';
import { MappingTreeModule } from './mqtt-mapping-tree/tree.module';
import { MappingComponent } from './mqtt-mapping/grid/mapping.component';
import { MappingTypeComponent } from './mqtt-mapping/mapping-type/mapping-type.component';
import { MappingModule } from './mqtt-mapping/mapping.module';
import { MonitoringComponent } from './mqtt-monitoring/grid/monitoring.component';
import { MonitoringModule } from './mqtt-monitoring/monitoring.module';
import { TestingComponent } from './mqtt-testing/grid/testing.component';
import { TestingModule } from './mqtt-testing/testing.module';
import { MappingNavigationFactory } from './navigation.factory';
import { ServiceMappingComponent } from './service-mapping.component';
import { JsonEditorComponent } from './shared/editor/jsoneditor.component';
import { OverviewGuard } from './shared/overview.guard';
import { SharedModule } from './shared/shared.module';
import { MappingTabFactory } from './tab.factory';

@NgModule({
  imports: [
    CoreModule,
    CommonModule,
    TestingModule,
    MappingModule,
    MappingTreeModule,
    MonitoringModule,
    ConfigurationModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild([
      {
        path: 'mqtt-mapping/configuration',
        pathMatch: 'full',
        component: BokerConfigurationComponent,
      },
      {
        path: 'mqtt-mapping/mapping',
        pathMatch: 'full',
        component: MappingComponent,
      },
      {
        path: 'mqtt-mapping/monitoring',
        pathMatch: 'full',
        component: MonitoringComponent,
      },
      {
        path: 'mqtt-mapping/testing',
        pathMatch: 'full',
        component: TestingComponent,
      },
      {
        path: 'mqtt-mapping/tree',
        pathMatch: 'full',
        component: MappingTreeComponent,
      },
    ]),
  ],
  exports: [
    ServiceMappingComponent,
  ],
  entryComponents: [ServiceMappingComponent],
  declarations: [
    ServiceMappingComponent,
    JsonEditorComponent
  ],
  providers: [
    OverviewGuard,
    { provide: HOOK_NAVIGATOR_NODES, useClass: MappingNavigationFactory, multi: true },
    { provide: HOOK_TABS, useClass: MappingTabFactory, multi: true },
    {
      provide: HOOK_ROUTE,
      useValue: [
        {
          path: 'mqtt-mapping/configuration',
          component: BokerConfigurationComponent,
        },
        {
          path: 'mqtt-mapping/mapping',
          component: MappingComponent,
        },
        {
          path: 'mqtt-mapping/monitoring',
          component: MonitoringComponent,
        },
        {
          path: 'mqtt-mapping/testing',
          component: TestingComponent,
        },
        {
          path: 'mqtt-mapping/tree',
          component: MappingTreeComponent,
        },
      ] as Route[],
      multi: true,
    },
    {
      provide: HOOK_WIZARD,
      useValue: {
        // The id of a wizard to which the entry should be hooked.
        wizardId: 'addMappingWizard_Id',
        // The container component is responsible for handling subsequent steps in the wizard.
        component: MappingTypeComponent,
        // Menu entry name
        name: 'App mapping',
        // Menu entry icon
        c8yIcon: 'plus-circle'
      },
      multi: true
    }
  ],
})
export class MQTTMappingModule {
  constructor() { }
}