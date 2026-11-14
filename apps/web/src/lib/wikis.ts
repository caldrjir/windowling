/**
 * Game wikis: guides and cheat sheets for games we play with friends (not games of the library).
 * Each wiki is a self-contained static page under `static/wiki/<id>/`, listed on the hub's
 * "Game wikis" tab.
 */
export interface WikiTexts {
	title: string;
	description: string;
	sections: string[];
}

export interface Wiki extends WikiTexts {
	id: string;
	/** The game's own name, the same in every language. */
	game: string;
	/** Short mark shown on the card. */
	mark: string;
	/** The game version the data is for. */
	version: string;
	/** Language the wiki itself is written in. */
	lang: 'cs' | 'en';
	path: string;
	/** Accent and background of the card. */
	colors: [string, string];
	en: WikiTexts;
}

export const WIKIS: Wiki[] = [
	{
		id: 'gzw',
		game: 'Gray Zone Warfare',
		mark: 'GZW',
		version: '0.5.1',
		lang: 'cs',
		path: '/wiki/gzw/',
		colors: ['#d4b062', '#111512'],
		title: 'Polní příručka',
		description:
			'Čím prorazíš jakou vestu, výkupní ceny 176 předmětů s ikonami a reputace obchodníků s kalkulačkou do dalšího ranku.',
		sections: ['Munice', 'Loot', 'Obchodníci'],
		en: {
			title: 'Field guide',
			description:
				'What penetrates which armour class, sell prices of 176 items with icons and vendor reputation with a calculator for the next rank.',
			sections: ['Ammo', 'Loot', 'Vendors'],
		},
	},
];
