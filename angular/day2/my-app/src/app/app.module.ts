import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
// 使用ngModel必须引入FormsModule模块
import { FormsModule } from '@angular/forms';
// http模块
import { HttpModule } from '@angular/http';
//引入路由模块
import { RouterModule } from '@angular/router';

//引入服务
import { DataService } from './services/app.service';

//公共组件
import { AppComponent } from './app.component';
import { HeaderComponent } from './components/header/app.header';
import { SearchComponent } from './components/search/app.search';
import { PannelComponent } from './components/pannel/app.pannel';
import { LoadingComponent } from './components/loading/app.loading';

//容器组件
import { HomeComponent } from './containers/home/app.home';
import { DetailComponent } from './containers/detail/app.detail';


@NgModule({
	//注册组件
	declarations: [
		AppComponent, HeaderComponent, SearchComponent, PannelComponent, LoadingComponent, HomeComponent, DetailComponent
	],
	//注册模块 内置插件
	imports: [
		BrowserModule, FormsModule, HttpModule, RouterModule.forRoot([{
			path: 'home',
			component: HomeComponent
		}, {
			path: 'detail',
			component: DetailComponent
		}])
	],
	//注册服务 自定义的公共方法
	providers: [DataService],
	bootstrap: [AppComponent]
})
export class AppModule {}