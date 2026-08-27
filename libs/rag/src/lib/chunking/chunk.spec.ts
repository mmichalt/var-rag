import { chunkPages } from './chunk.js';

const pages = [
  [
    'LAW 12 – Fouls and Misconduct',
    '',
    'Handball',
    '',
    'A player is penalised for handball if they deliberately touch the ball with their hand or arm.',
    '',
    "It is not usually an offence if the ball touches a player's hand or arm directly from their own head or body.",
  ].join('\n'),
  [
    'LAW 14 – The Penalty Kick',
    '',
    'Procedure',
    '',
    'A penalty kick is awarded if a player commits a direct free kick offence inside their own penalty area.',
  ].join('\n'),
];

describe('chunkPages', () => {
  it('is deterministic and emits locators with law numbers', () => {
    const first = chunkPages(pages);
    const second = chunkPages(pages);
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThanOrEqual(2);
    const handball = first.find((chunk) =>
      chunk.sourceText.includes('penalised for handball'),
    );
    expect(handball).toBeDefined();
    if (!handball) {
      return;
    }
    expect(handball.locator.lawNumber).toBe('12');
    expect(handball.locator.headingPath.join(' > ')).toMatch(/Law 12/);
    expect(handball.locator.headingPath).toContain('Handball');
    expect(
      handball.retrievalText.startsWith(
        handball.locator.headingPath.join(' > '),
      ),
    ).toBe(true);
    expect(handball.retrievalText).toContain(handball.sourceText);
    expect(handball.locator.pageStart).toBe(1);
  });

  it('never uses retrievalText as the quoted source', () => {
    for (const chunk of chunkPages(pages)) {
      expect(chunk.sourceText.includes('\n\n')).toBe(false);
      expect(chunk.retrievalText.includes(chunk.sourceText)).toBe(true);
    }
  });

  it('keeps wrapped body lines in sourceText instead of treating them as headings', () => {
    const wrapped = chunkPages([
      [
        'LAW 11 – Offside',
        'Offside Offence',
        'A player in an offside position at the moment the ball is played or touched by a',
        'team-mate is only penalised on becoming involved in active play by interfering',
        'with play, interfering with an opponent, or gaining an advantage.',
      ].join('\n'),
    ]);
    const source = wrapped.map((chunk) => chunk.sourceText).join(' ');
    expect(source).toContain('A player in an offside position');
    expect(source).toContain('team-mate is only penalised');
    expect(
      wrapped.some((chunk) =>
        chunk.locator.headingPath.includes('Offside Offence'),
      ),
    ).toBe(true);
    expect(
      wrapped.some((chunk) =>
        chunk.locator.headingPath.some((part) => part.includes('touched by a')),
      ),
    ).toBe(false);
  });
});
