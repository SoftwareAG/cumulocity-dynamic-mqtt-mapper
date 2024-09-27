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
 * @authors Christof Strack
 */
import { inject, Injectable } from '@angular/core';
import { FetchClient, IFetchResponse } from '@c8y/client';
import {
  BASE_URL,
  CONNECTOR_FRAGMENT,
  ConnectorConfiguration,
  ConnectorSpecification,
  ConnectorStatus,
  ConnectorStatusEvent,
  PATH_CONFIGURATION_CONNECTION_ENDPOINT,
  PATH_STATUS_CONNECTORS_ENDPOINT,
  SharedService,
  StatusEventTypes
} from '.';

import {
  combineLatest,
  concat,
  from,
  merge,
  Observable,
  Subject,
  Subscription
} from 'rxjs';
import {
  filter,
  map,
  scan,
  shareReplay,
  startWith,
  switchMap,
  tap
} from 'rxjs/operators';
import {
  EventRealtimeService,
  RealtimeSubjectService
} from '@c8y/ngx-components';

@Injectable({ providedIn: 'root' })
export class ConnectorConfigurationService {
  constructor(
    private client: FetchClient,
    private sharedService: SharedService
  ) {
    this.eventRealtimeService = new EventRealtimeService(
      inject(RealtimeSubjectService)
    );
    this.startConnectorConfigurations();
    this.sharedConnectorConfigurations$ = this.connectorConfigurations$.pipe(
      // tap(() => console.log('Further up I')),
      shareReplay(1),
      switchMap((configurations: ConnectorConfiguration[]) => {
        return combineLatest([
          from([configurations]),
          this.getCombinedConnectorStatus()
        ]).pipe(
          map(([configs, statusMap]) => {
            // console.log('Changes configs:', configs);
            // console.log('Changes statusMap:', statusMap);
            return configs.map((config) => ({
              ...config,
              status$: new Observable<ConnectorStatus>((observer) => {
                if (statusMap[config.ident]) {
                  observer.next(statusMap[config.ident].status);
                }
                return () => {}; // Cleanup function
              })
            }));
          })
        );
      })
    );
  }

  private _connectorConfigurations: ConnectorConfiguration[];
  private _connectorSpecifications: ConnectorSpecification[];

  private triggerConfigurations$: Subject<string> = new Subject();

  private initialized: boolean = false;
  private eventRealtimeService: EventRealtimeService;
  private subscription: Subscription;
  private connectorConfigurations$: Observable<ConnectorConfiguration[]>;
  private sharedConnectorConfigurations$: Observable<ConnectorConfiguration[]>;

  resetCache() {
    // console.log('Calling: BrokerConfigurationService.resetCache()');
    this._connectorConfigurations = [];
    this._connectorSpecifications = undefined;
  }

  startConnectorConfigurations() {
    if (!this.initialized) {
      this.initialized = true;
      this.connectorConfigurations$ = merge(
        from(this.getConnectorConfigurations()),
        this.triggerConfigurations$.pipe(
          switchMap(() => from(this.getConnectorConfigurations()))
        )
      ).pipe(
        tap(() => console.log('Something happened')),
        shareReplay(1)
      );
      // this.testRealtime();
    }
  }

  updateConnectorConfigurations() {
    const n = Date.now();
    this.triggerConfigurations$.next('refresh' + '/' + n);
  }

  stopConnectorConfigurations() {
    if (this.subscription) this.subscription.unsubscribe();
  }

  async getConnectorSpecifications(): Promise<ConnectorSpecification[]> {
    if (!this._connectorSpecifications) {
      const response = await this.client.fetch(
        `${BASE_URL}/${PATH_CONFIGURATION_CONNECTION_ENDPOINT}/specifications`,
        {
          headers: {
            accept: 'application/json'
          },
          method: 'GET'
        }
      );
      this._connectorSpecifications = await response.json();
    }
    return this._connectorSpecifications;
  }

  async getConnectorStatus(): Promise<{
    [ident: string]: ConnectorStatusEvent;
  }> {
    const response = await this.client.fetch(
      `${BASE_URL}/${PATH_STATUS_CONNECTORS_ENDPOINT}`,
      {
        method: 'GET'
      }
    );
    const result = await response.json();
    return result;
  }

  async updateConnectorConfiguration(
    configuration: ConnectorConfiguration
  ): Promise<IFetchResponse> {
    return this.client.fetch(
      `${BASE_URL}/${PATH_CONFIGURATION_CONNECTION_ENDPOINT}/instance/${configuration.ident}`,
      {
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(configuration),
        method: 'PUT'
      }
    );
  }

  async createConnectorConfiguration(
    configuration: ConnectorConfiguration
  ): Promise<IFetchResponse> {
    return this.client.fetch(
      `${BASE_URL}/${PATH_CONFIGURATION_CONNECTION_ENDPOINT}/instance`,
      {
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(configuration),
        method: 'POST'
      }
    );
  }

  async deleteConnectorConfiguration(ident: string): Promise<IFetchResponse> {
    return this.client.fetch(
      `${BASE_URL}/${PATH_CONFIGURATION_CONNECTION_ENDPOINT}/instance/${ident}`,
      {
        headers: {
          accept: 'application/json',
          'content-type': 'application/json'
        },
        method: 'DELETE'
      }
    );
  }

  async getConnectorConfigurations(): Promise<ConnectorConfiguration[]> {
    const response = await this.client.fetch(
      `${BASE_URL}/${PATH_CONFIGURATION_CONNECTION_ENDPOINT}/instances`,
      {
        headers: {
          accept: 'application/json'
        },
        method: 'GET'
      }
    );
    this._connectorConfigurations = await response.json();

    return this._connectorConfigurations;
  }

  private getConnectorStatusEvents(): Observable<ConnectorStatusEvent> {
    // subscribe to event stream
    this.eventRealtimeService.start();
    return from(this.sharedService.getDynamicMappingServiceAgent()).pipe(
      switchMap((agentId) => {
        return concat(
          this.eventRealtimeService.onAll$(agentId).pipe(
            filter(
              (p) =>
                p['data']['type'] ==
                StatusEventTypes.STATUS_CONNECTOR_EVENT_TYPE
            ),
            map((p) => {
              const connectorFragment = p['data'][CONNECTOR_FRAGMENT];
              return {
                connectorIdent: connectorFragment.connectorIdent,
                connectorName: connectorFragment.connectorName,
                status: connectorFragment.status,
                message: connectorFragment.message,
                type: connectorFragment.type
              };
            }),
            tap((p) => {
              console.log('Status change connector original:', p);
            })
          )
        );
      })
    );
  }

  private async testRealtime() {
    console.log('Calling testRealtime');

    const eventRealtimeService = new EventRealtimeService(
      inject(RealtimeSubjectService)
    );
    eventRealtimeService.start();

    eventRealtimeService
      .onAll$('9262685372')
      .pipe(
        //  map((p) => p['data']),
        // filter((p) => p['type'] == StatusEventTypes.STATUS_CONNECTOR_EVENT_TYPE),
        tap((p) => {
          console.log('Status change connector simple:', p);
        })
      )
      .subscribe();
  }

  private updateRealtimeConnectorStatus = async (p: object) => {
    const payload = p['data']['data'];
    console.log('Status change connector old fashin:', payload);
  };

  getCombinedConnectorStatus(): Observable<{
    [ident: string]: ConnectorStatusEvent;
  }> {
    console.log('Calling - getCombinedConnectorStatus:');
    // Create an Observable that combines initial status with real-time updates
    return combineLatest([
      from(this.getConnectorStatus()),
      this.getConnectorStatusEvents().pipe(
        tap(() => console.log('Source IIb')),
        // // Start with an empty event to trigger initial emission
        startWith({
          connectorIdent: 'EMPTY',
          status: ConnectorStatus.UNKNOWN,
          message: 'EMPTY_FROM_BEFORE_SCAN'
        } as ConnectorStatusEvent),
        // Accumulate status updates
        scan(
          (acc, event) => {
            // console.log('Changes acc I:', acc);
            // console.log('Changes event I:', event);
            // console.log('Changes merged I:', {
            //   ...acc,
            //   [event.ident]: event
            // });
            return {
              ...acc,
              [event.connectorIdent]: event
            };
          },
          {} as { [ident: string]: ConnectorStatusEvent }
        )
      )
    ]).pipe(
      // Combine initial status with accumulated updates
      map(([initial, updates]) => {
        // console.log('Changes initial II:', initial);
        // console.log('Changes updates II:', updates);
        // console.log('Changes merged II:', {
        //   ...initial,
        //   ...updates
        // });
        return {
          ...initial,
          ...updates
        };
      }),
      // Share the result to multiple subscribers
      shareReplay(1)
    );
  }

  getConnectorConfigurationsWithLiveStatus(): Observable<
    ConnectorConfiguration[]
  > {
    console.log('Further up 0');
    return this.sharedConnectorConfigurations$;
  }
}
