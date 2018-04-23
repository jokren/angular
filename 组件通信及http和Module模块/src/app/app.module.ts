import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';


import { AppComponent } from './app.component';
import { HeaderComponent } from './components/header/header';
import { NavComponent } from './components/nav/nav';

//引入服务
import { DataService } from './services/app.service';

@NgModule({
  //注册组件
  declarations: [
    AppComponent,HeaderComponent,NavComponent
  ],
  //注册模板,插件
  imports: [
    BrowserModule
  ],
  //注册服务,自定义的公共的方法
  providers: [DataService],
  bootstrap: [AppComponent]
})
export class AppModule { }
