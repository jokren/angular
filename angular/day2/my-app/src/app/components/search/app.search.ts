import { Component } from '@angular/core';
@Component({
  selector: 'xsearch',
  templateUrl: './app.xsearch.html',
  styleUrls: ['./app.xsearch.css'],
})
export class SearchComponent {
  title = 'app';
  bool = false;
  inputsearch = "asdasdasd";
  
  showSearchInput(){
  	this.bool = !this.bool
  }
  hideSearchInput(){
  	this.bool = !this.bool
  }
  searchClear(){
  	this.inputsearch = ""
  }
}
