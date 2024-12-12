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

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import dynamic.mapping.processor.extension.ProcessorExtensionSource;
import dynamic.mapping.processor.extension.ProcessorExtensionTarget;

import jakarta.validation.constraints.NotNull;
import java.io.Serializable;

@Getter
@Setter
@NoArgsConstructor
@ToString
@Builder
@AllArgsConstructor
public class ExtensionEntry implements Serializable {

    @NotNull
    private String extensionName;

    @NotNull
    private String eventName;
    
    @NotNull
    private String fqnClassName;
    
    @NotNull
    private boolean loaded;
    
    @NotNull
    private String message;

    @NotNull
    private ExtensionType extensionType;

    @NotNull
    @JsonIgnore
    @Builder.Default
    private ProcessorExtensionSource<?> extensionImplSource = null;
    
    @NotNull
    @JsonIgnore
    @Builder.Default
    private ProcessorExtensionTarget<?> extensionImplTarget = null;
    
}
