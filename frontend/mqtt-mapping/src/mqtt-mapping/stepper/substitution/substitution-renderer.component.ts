import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild, ViewEncapsulation } from '@angular/core';
import { definesDeviceIdentifier } from '../../../shared/helper';
import { Mapping, MappingSubstitution } from '../../../shared/configuration.model';


@Component({
  selector: 'mapping-substitution-renderer',
  templateUrl: 'substitution-renderer.component.html',
  styleUrls: ['./substitution-renderer.style.css',
  ],
  encapsulation: ViewEncapsulation.None,
})

export class SubstitutionRendererComponent implements OnInit {

  @Input()
  substitutions: MappingSubstitution[] = [];

  @Input()
  targetAPI: string;

  @Input()
  setting: any;

  @Output() onSelect = new EventEmitter<number>();

  definesDeviceIdentifier = definesDeviceIdentifier;

  constructor(  private elementRef: ElementRef,) { }

  ngOnInit() {
    console.log ("Setting for renderer:", this.setting)
  }

  onSubstitutionSelected (index: number) {
    console.log("Selected substitution:", index);
    this.setting.selectedSubstitutionIndex = index;
    this.onSelect.emit(index);
  }

  public scrollToSubstitution(i: number){
    i++;
    if (!i || i < 0 || i >= this.substitutions.length) {
      i = 0;
    }
    console.log ("Scroll to:", i);
    this.elementRef.nativeElement.querySelector("#sub-" + i ).scrollIntoView();
  }
}
