import clone from "lodash.clonedeep";

import SkillData from "../constants/SkillData";

import LocalizationService from "./LocalizationService";
import TTSService from "./TTSService";

class SpellService {
	valid_names = {};
	spells      = {};
	tts_log     = {};
	settings    = {};

	stop() {
		this.spells = {};
	}

	setSettings(use_tts, tts_trigger, warning_threshold) {
		this.settings.use_tts           = use_tts;
		this.settings.tts_trigger       = tts_trigger;
		this.settings.warning_threshold = warning_threshold;
	}

	processSpells(used, lost) {
		for (let i in used) {
			let date     = used[i].time;
			let new_date = new Date(date);
			let recast   = 0;
			let dot      = false;
			let type     = used[i].type;

			if (new_date.getFullYear() !== 1970) {
				switch (type) {
					case "skill":
						recast = SkillData.oGCDSkills[used[i].id].recast;

						break;

					case "effect":
						recast = used[i].duration;

						break;

					default:
						break;
				}
				
				new_date.setSeconds(date.getSeconds() + recast);
			}

			this.spells[i] = {
				type          : used[i].type,
				subtype       : used[i].subtype,
				log_type      : used[i].log_type,
				id            : used[i].id,
				time          : new_date,
				name          : used[i].name,
				recast        : recast,
				remaining     : recast,
				cooldown      : Math.max(0, recast),
				dot           : (used[i].subtype === "dot"),
				party         : used[i].party,
				defaulted     : used[i].defaulted,
				type_position : used[i].type_position,
				tts           : false
			};
		}

		for (let i in lost) {
			if (!this.spells[i]) {
				continue;
			}

			this.spells[i].remaining = 0;
			this.spells[i].cooldown  = 0;

			this.processTTS(i);
		}
	}

	updateCooldowns() {
		let now       = new Date();
		let changed   = false;
		let threshold = (this.settings.tts_trigger === "zero") ? 0 : this.settings.warning_threshold;

		for (let i in this.spells) {
			if (this.spells[i].cooldown === 0) {
				continue;
			}

			changed = true;

			this.spells[i].remaining = (this.spells[i].time - now) / 1000;
			this.spells[i].cooldown  = Math.max(0, this.spells[i].remaining);

			if (this.settings.use_tts && this.spells[i].remaining > -10000000 && this.spells[i].remaining <= threshold) {
				this.processTTS(i);
			}
		}

		return changed;
	}

	processTTS(key) {
		if (this.spells[key].tts) {
			return;
		}

		let log_key = `${this.spells[key].subtype}-${this.spells[key].id}`;
		let time    = (new Date()).getTime();

		if ((time - (this.tts_log[log_key] || 0)) <= 500) {
			this.tts_log[log_key] = time;

			return false;
		}

		this.spells[key].tts = true;

		this.tts_log[log_key] = time;

		TTSService.saySpell(key, this.spells[key].id, this.spells[key].type, this.spells[key].name);
	}

	filterSpells(section, settings, builder) {
		let spells = clone(this.spells);

		for (let i in spells) {
			if (builder && section.types.indexOf(spells[i].log_type) === -1) {
				delete spells[i];

				continue;
			}

			if (spells[i].cooldown <= 0 && !settings[`always_${spells[i].subtype}`]) {
				delete spells[i];

				continue;
			}
		}

		return spells;
	}

	updateValidNames(state) {
		this.valid_names = {
			spells        : {},
			effects       : {},
			dots          : {},
			party_spells  : {},
			party_effects : {},
			party_dots    : {}
		};

		for (let key in this.valid_names) {
			for (let id of state.settings.spells_mode[key]) {
				this.valid_names[key][LocalizationService.getEffectName(id, "en")] = true;
			}
		}
	}

	isValidName(key, name) {
		return (this.valid_names[key] && this.valid_names[key][name]);
	}

	injectDefaults(state) {
		let job = state.internal.character_job;

		if (!job) {
			return state;
		}

		let data         = {
			skill  : state.settings.spells_mode.spells,
			effect : state.settings.spells_mode.effects,
			dot    : state.settings.spells_mode.dots
		}
		let in_use_names = [];

		for (let i in state.internal.spells.in_use) {
			if (state.internal.spells.in_use[i].time.getFullYear() === 1970) {
				delete state.internal.spells.in_use[i];
				continue;
			}

			let item = state.internal.spells.in_use[i];

			switch (item.type) {
				case "skill":
					in_use_names.push(item.type + "-" + LocalizationService.getoGCDSkillName(item.id, "en"));
					break;
	
				case "effect":
					type = item.subtype;

					in_use_names.push(type + "-" + LocalizationService.getEffectName(item.id, "en"));
					break;
	
				default:
					break;
			}
		}

		for (let type in data) {
			if (!state.settings.spells_mode[`always_${type}`]) {
				continue;
			}

			let type_position = 0;

			for (let id of data[type]) {
				let name = type + "-";

				switch (type) {
					case "skill":
						name += LocalizationService.getoGCDSkillName(id, "en");
						break;
		
					case "effect":	
						name += LocalizationService.getEffectName(id, "en");

						break;
		
					default:
						break;
				}

				if (in_use_names.indexOf(name) !== -1) {
					continue;
				}

				let main_type = (type === "dot") ? "effect" : type;
				let key       = `${main_type}-${id}`;

				state.internal.spells.defaulted[name] = {
					id  : id,
					key : key
				};
				state.internal.spells.in_use[key]     = {
					type          : main_type,
					subtype       : type,
					id            : +id,
					time          : new Date("1970-01-01"),
					duration      : 0,
					log_type      : `you-${type}`,
					party         : false,
					defaulted     : true,
					type_position : ++type_position
				};
			}
		}
	}
}

export default new SpellService();