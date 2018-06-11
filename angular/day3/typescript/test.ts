let bool: boolean = false;
let num: number = 9;
class Greeter {
	greeting: string;
	constructor(message: string) {
		this.greeting = message;
	}
	greet(): string {
		return "Hello, " + this.greeting;
	}
}