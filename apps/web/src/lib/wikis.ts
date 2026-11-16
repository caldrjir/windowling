/**
 * Game wikis: guides and cheat sheets for games we play with friends (not games of the library).
 * Each wiki is a self-contained static page under `static/wiki/<id>/` (other languages in
 * subfolders, e.g. `en/`), listed on the hub's "Game wikis" tab.
 */
export type WikiLang = 'cs' | 'en';

export interface WikiTexts {
	title: string;
	description: string;
	sections: string[];
}

export interface WikiLink {
	label: string;
	href: string;
}

export interface Wiki extends WikiTexts {
	id: string;
	/** The game's own name, the same in every language. */
	game: string;
	/** Short mark shown on the card. */
	mark: string;
	/** The game version the data is for. */
	version: string;
	/** The wiki's pages by language; the card opens the one in the hub's language. */
	pages: Partial<Record<WikiLang, string>>;
	/** Other places to read about the game, opened in a new tab. */
	links: WikiLink[];
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
		pages: { cs: '/wiki/gzw/', en: '/wiki/gzw/en/' },
		links: [
			{
				label: 'Fandom wiki',
				href: 'https://gray-zone-warfare.fandom.com/wiki/Gray_Zone_Warfare_Wiki',
			},
		],
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

/** The wiki page in the given language, or the first one it has. */
export function wikiPage(w: Wiki, lang: WikiLang): string {
	return w.pages[lang] ?? Object.values(w.pages)[0] ?? '/';
}
