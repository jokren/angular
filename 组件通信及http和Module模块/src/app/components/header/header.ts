import { Component } from '@angular/core';

//http发ajax请求
import { Http } from '@angular/http'; // (1)步骤1
import 'rxjs/add/operator/map'; // (2)步骤2 导入RxJS中的map操作符

//注入service，实现组件通信   react-redux   connect->store
import { DataService } from '../../services/app.service';

@Component({
  selector: 'xheader',
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent {
  page=1;
  loadMore() {
    this.http.get(`https://cnodejs.org/api/v1/topics?limit=5&page=${this.page}`) // (4)
      .map(res => res.json()) // (5)
      .subscribe(data => {
        console.log(data)
      });
  }
  constructor(private http: Http,private dataService: DataService) {}  //http  步骤3
  title = '邵阳';
  getservice(){
    this.dataService.bool=!this.dataService.bool;
  }
}
