import { Component } from '@angular/core';

//注入service，实现组件通信   react-redux   connect->store
import { DataService } from '../../services/app.service';

@Component({
  selector: 'xloading',
  templateUrl: './app.loading.html',
  styleUrls: ['./app.loading.css']
})
export class LoadingComponent {
	constructor(public dataService: DataService) {} //(3)步骤3
	//Model
  title = '天天头条';
}
