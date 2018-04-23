import { Component } from '@angular/core';

//注入service，实现组件通信   react-redux   connect->store
import { DataService } from '../../services/app.service';

@Component({
  selector: 'xnav',
  templateUrl: './nav.html',
  styleUrls: ['./nav.css']
})
export class NavComponent {
  constructor(private dataService: DataService) {}
  nav="导航"
}
