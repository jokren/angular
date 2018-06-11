var bool = false;
var num = 9;
var Greeter = /** @class */ (function () {
    function Greeter(message) {
        this.greeting = message;
    }
    Greeter.prototype.greet = function () {
        return "Hello, " + this.greeting;
    };
    return Greeter;
}());

var num = (function(){
	var a = 1
	return a
}());
//react
var obj = new Greeter("xxx")
