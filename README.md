# 介绍

## my-app(angular4.0外壳)
angular4.0  用cli脚手架直接搭建

## 组件通信及http和Module模块

  #### service:
  ```file
     要实现组件之间通信,首先要在app.module.ts中注册,
     再需要在通信组件中都注入service
     及constructor(private dataService: DataService) {}.
  ```

 #### http和module的使用:
 ```file
    必须先引入模块,如第三方模块的引入
  ```

 #### http模块:每个需要使用的组件都要注入:
 ```file
    import { Http } from '@angular/http'; // (1)步骤1
    import 'rxjs/add/operator/map'; // (2)步骤2 导入RxJS中的map操作符
    及constructor(private http: Http {}  //(3)步骤3

 ```



