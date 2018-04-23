import { Component } from '@angular/core';

//注入service，实现组件通信   react-redux   connect->store
import { DataService } from '../../services/app.service';

@Component({
  selector: 'xheader',
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent {
  constructor(private dataService: DataService) {}
  title = '邵阳';
  getservice(){
    this.dataService.bool=!this.dataService.bool;
  }
}
