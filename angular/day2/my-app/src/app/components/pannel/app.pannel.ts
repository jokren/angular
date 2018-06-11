import { Component } from '@angular/core';
//http发ajax请求
import { Http } from '@angular/http'; // (1)步骤1
import 'rxjs/add/operator/map'; // (2)步骤2 导入RxJS中的map操作符

//注入service，实现组件通信   react-redux   connect->store
import { DataService } from '../../services/app.service';

@Component({
	selector: 'xpannel',
	templateUrl: './app.pannel.html',
	styleUrls: ['./app.pannel.css'],
})
export class PannelComponent {
	//Model
	title = '天天头条';
	/*items = [{
		title: "标题一",
		decription: "由各种物质组成的巨型球状天体，叫做星球。星球有一定的形状，有自己的运行轨道。"
	}, {
		title: "标题二",
		decription: "由各种物质组成的巨型球状天体，叫做星球。星球有一定的形状，有自己的运行轨道。"
	}, {
		title: "标题三",
		decription: "奥术大师多。"
	}];*/
	items = [];
	page = 1;
	loadMore() {
		/*this.items.push({
			title: "asdhnkasdj",
			decription: "aaaaaaaaaaaaaaaaaa"
		});*/
		this.dataService.bool = true;
		this.http.get(`https://cnodejs.org/api/v1/topics?limit=5&page=${this.page}`) // (4)
			.map(res => res.json()) // (5)
			.subscribe(data => {
				console.log(data)
				if(data) this.items = this.items.concat(data.data); // (6)
				this.dataService.bool = false;
				this.page++;
			});
	}
	constructor(private http: Http, public dataService: DataService) {} //(3)步骤3
	//生命周期  mounted
	ngOnInit() {
		this.loadMore();
		console.log(this);
	}
}