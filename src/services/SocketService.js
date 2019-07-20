import SocketMessageProcessor from "../processors/SocketMessageProcessor";

const querystring = require("querystring");

class SocketService {
	constructor(uri) {
		this.message_processor = new SocketMessageProcessor();
		this.uri               = uri || this.processUri();
	}

	processUri() {
		let params = new querystring.parse(window.location.search);
		let uri    = params["?HOST_PORT"];

		if (!uri) {
			return false;
		}

		uri = uri.replace(/\/$/, "");

		if (uri.indexOf("MiniParse") === -1) {
			uri = uri + "/MiniParse";
		}

		return uri;
	}

	initialize() {
		if (!this.uri) {
			return;
		}

		this.socket = new WebSocket(this.uri);

		this.socket.onmessage = this.message_processor.processMessage;
		this.socket.onclose   = this.reconnect.bind(this);
		this.socket.onopen    = this.setId.bind(this);
	}

	reconnect() {
		this.initialize();
	}

	setId() {
		let id = Math.random().toString(36).substring(7);

		this.id = id;

		this.send("set_id", undefined, undefined, undefined, id);
	}

	splitEncounter() {
		this.send("overlayAPI", this.id, "RequestEnd");
	}

	send(type, to, message_type, message, id) {
		if (!this.socket || this.socket.readyState !== 1) {
			return;
		}

		let data = {
			type    : type,
			to      : to,
			msgtype : message_type,
			msg     : message,
			id      : id
		};

		this.socket.send(JSON.stringify(data));
	}
}

export default SocketService;