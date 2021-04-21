import clone from "lodash.clonedeep";
import Constants from "../constants";

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

	processSpells(used, lost, changed_default) {
		for (let i in used) {
			let date     = used[i].time;
			let new_date = new Date(date);
			let recast   = 0;
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

		for (let i in changed_default) {
			if (!this.spells[i]) {
				continue;
			}

			this.spells[i].defaulted     = changed_default[i].defaulted;
			this.spells[i].type_position = changed_default[i].position;
		}
	}

	resetSpell(i) {
		delete this.spells[i];
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

			if (spells[i].cooldown <= 0 && (!spells[i].defaulted || !settings[`always_${spells[i].subtype}`])) {
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
			let type = key.split("_");

			type = (type.length === 1) ? type[0] : type[1];
			type = type.substring(0, type.length - 1);

			for (let id of state.settings.spells_mode[key]) {
				this.valid_names[key][LocalizationService.getSpellName(type, id, "en")] = true;
			}
		}
	}

	isValidName(key, name) {
		return (this.valid_names[key] && this.valid_names[key][name]);
	}

	isValidJob(type, id, job_abbreviation) {
		let job = Constants.GameJobs[job_abbreviation];

		if (!job) {
			return;
		}

		let role = job.role;
		let data = [];

		switch (type) {
			case "spell":
			case "skill":
				data = (SkillData.oGCDSkills[id]) ? SkillData.oGCDSkills[id].jobs : false;

				break;

			case "effect":
			case "dot":
				data = (SkillData.Effects[id]) ? SkillData.Effects[id].jobs : false;

				break;

			default:
				return false;
		}

		return (data) ? (data.indexOf(job_abbreviation) !== -1 || data.indexOf(role) !== -1) : false;
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
		};
		let data_names   = [];
		let in_use_names = {};

		for (let type in data) {
			for (let id of data[type]) {
				data_names.push(type + "-" + LocalizationService.getSpellName(type, id, "en"));
			}
		}

		for (let i in state.internal.spells.in_use) {
			let item = state.internal.spells.in_use[i];

			if (!item.defaulted) {
				continue;
			}

			let name = item.subtype + "-" + LocalizationService.getSpellName(item.subtype, item.id, "en");

			if (data_names.indexOf(name) === -1) {
				state.internal.spells.in_use[i].defaulted = false;
			} else {
				in_use_names[name] = i;
			}
		}

		for (let type in data) {
			if (!state.settings.spells_mode[`always_${type}`]) {
				continue;
			}

			let type_position = 0;

			for (let id of data[type]) {
				if (!this.isValidJob(type, id, job)) {
					continue;
				}

				let name = type + "-" + LocalizationService.getSpellName(type, id, "en");

				type_position++;

				if (in_use_names[name]) {
					state.internal.spells.in_use[in_use_names[name]].type_position = type_position;

					state.internal.spells.defaulted[name].position = type_position;
					continue;
				}

				let main_type = (type === "dot") ? "effect" : type;
				let key       = `${main_type}-${id}`;

				state.internal.spells.defaulted[name] = {
					id       : id,
					key      : key,
					position : type_position
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
					type_position : state.internal.spells.defaulted[name].position
				};
			}
		}
	}
}

export default new SpellService();