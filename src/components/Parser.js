import React from "react";
import { connect } from "react-redux";

import "./../styles/components/parser/parser-theme.less";

import Container from "./Parser/Container";
import Placeholder from "./Parser/Placeholder";

class Parser extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			collapsed_modes : {
				stats  : false,
				spells : false,
			},
			always_visible : {
				spells : true
			}
		};
	}

	componentWillMount() {
		window.parser = true;

		this.setState({
			visible : true
		});

		setInterval(this.processAutoHide.bind(this), 2000);
	}

	componentDidUpdate() {
		if (this.props.mode === "spells") {
			if (this.props.has_spells !== this.state.collapsed_modes.spells) {
				let state = this.state;

				state.collapsed_modes.spells = this.props.has_spells;

				this.setState(state);
			}
		}
	}

	processAutoHide() {
		let visible = true;

		if (this.state.always_visible[this.props.mode]) {
			return;
		}

		if (this.props.auto_hide && this.props.auto_hide_delay > 0 && ((new Date().getTime() / 1000) - this.props.last_activity) > this.props.auto_hide_delay) {
			visible = false;
		}

		if (this.state.visible !== visible) {
			this.setState({
				visible : visible
			});
		}
	}

	render() {
		let collapsed          = ((this.props.collapsed && this.props.viewing === "tables") || this.state.collapsed_modes[this.props.mode]);
		let is_spells          = (this.props.mode === "spells");
		let collapse_down      = this.shouldCollapseDown(is_spells);
		let root_inner_classes = [];
		let opacity            = this.props.opacity / 100;
		let zoom               = this.props.zoom / 100;
		let context_zoom       = 1 / zoom;
		let display            = (this.state.visible) ? "block" : "none";
		let setting_style      = `
			body {
				zoom: ${zoom};
				display: ${display};
			}

			.container-context-menu {
				zoom: ${context_zoom};
			}

			.container-context-menu .item-group {
				zoom: ${zoom};
			}

			#container {
				opacity: ${opacity};
			}

			.resizeHandle {
				background-image: url("img/handle.png");
			}
		`;

		if (collapsed) {
			if (!this.props.using_ui_builder) {
				root_inner_classes.push("auto-height");
			}

			if (collapse_down) {
				root_inner_classes.push("down");
			}

			if (is_spells && this.props.invert_spells_horizontal) {
				root_inner_classes.push("right");
			}
		}

		root_inner_classes = root_inner_classes.join(" ");

		return (
			<React.Fragment>
				<style type="text/css">
					{setting_style}
					{this.props.css}
				</style>
				<Placeholder type="top left" theme={this.props.theme}/>
				<Placeholder type="top right" theme={this.props.theme}/>
				<Placeholder type="bottom left" theme={this.props.theme}/>
				<Placeholder type="bottom right" theme={this.props.theme}/>
				<div id="root-inner" className={root_inner_classes}>
					<Container/>
				</div>
			</React.Fragment>
		);
	}

	shouldCollapseDown(is_spells) {
		return ((!is_spells && this.props.collapse_down) || (is_spells && this.props.invert_spells_vertical));
	}
}

const mapStateToProps = (state) => {
	return {
		collapsed                : state.settings.intrinsic.collapsed,
		collapse_down            : state.settings.interface.collapse_down,
		viewing                  : state.internal.viewing,
		css                      : state.settings.custom.css || "",
		opacity                  : state.settings.interface.opacity,
		zoom                     : state.settings.interface.zoom,
		theme                    : state.settings.interface.theme,
		auto_hide                : state.settings.interface.auto_hide,
		auto_hide_delay          : state.settings.interface.auto_hide_delay,
		last_activity            : state.last_activity,
		mode                     : state.internal.mode,
		invert_spells_vertical   : state.settings.spells_mode.invert_vertical,
		invert_spells_horizontal : state.settings.spells_mode.invert_horizontal,
		has_spells               : (Object.keys(state.internal.spells.in_use).length > 0),
		using_ui_builder         : state.settings.spells_mode.ui.use,
	};
};

export default connect(mapStateToProps)(Parser);