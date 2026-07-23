import { validate } from 'class-validator';
import { UpdateMeDto } from './update-me.dto.js';

const makeDto = (overrides: Partial<UpdateMeDto> = {}) =>
  Object.assign(new UpdateMeDto(), overrides);

describe('UpdateMeDto', () => {
  it('accepts an empty object (all fields optional)', async () => {
    const errors = await validate(makeDto());
    expect(errors).toHaveLength(0);
  });

  it('rejects a new password shorter than 12 characters', async () => {
    const errors = await validate(makeDto({ password: 'short789' }));
    const passwordErrors = errors.filter(
      (error) => error.property === 'password',
    );
    expect(passwordErrors.length).toBeGreaterThan(0);
  });

  it('accepts a currentPassword of any length (no minimum enforced)', async () => {
    const errors = await validate(makeDto({ currentPassword: 'short' }));
    const passwordErrors = errors.filter(
      (error) => error.property === 'currentPassword',
    );
    expect(passwordErrors).toHaveLength(0);
  });

  it('rejects an invalid theme value', async () => {
    const errors = await validate(makeDto({ theme: 'not-a-real-theme' }));
    const themeErrors = errors.filter((error) => error.property === 'theme');
    expect(themeErrors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid mode value', async () => {
    const errors = await validate(makeDto({ mode: 'sepia' }));
    const modeErrors = errors.filter((error) => error.property === 'mode');
    expect(modeErrors.length).toBeGreaterThan(0);
  });

  it('accepts a valid theme value', async () => {
    const errors = await validate(makeDto({ theme: 'scanner-darkly' }));
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid mode value', async () => {
    const errors = await validate(makeDto({ mode: 'dark' }));
    expect(errors).toHaveLength(0);
  });

  it('accepts cvdMode: true', async () => {
    const errors = await validate(makeDto({ cvdMode: true }));
    expect(errors).toHaveLength(0);
  });

  it('accepts cvdMode: false', async () => {
    const errors = await validate(makeDto({ cvdMode: false }));
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-boolean cvdMode value', async () => {
    const errors = await validate(
      makeDto({ cvdMode: 'yes' as unknown as boolean }),
    );
    const cvdErrors = errors.filter((error) => error.property === 'cvdMode');
    expect(cvdErrors.length).toBeGreaterThan(0);
  });

  it('accepts dyslexicFont: true', async () => {
    const errors = await validate(makeDto({ dyslexicFont: true }));
    expect(errors).toHaveLength(0);
  });

  it('accepts dyslexicFont: false', async () => {
    const errors = await validate(makeDto({ dyslexicFont: false }));
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-boolean dyslexicFont value', async () => {
    const errors = await validate(
      makeDto({ dyslexicFont: 'yes' as unknown as boolean }),
    );
    const dyslexicFontErrors = errors.filter(
      (error) => error.property === 'dyslexicFont',
    );
    expect(dyslexicFontErrors.length).toBeGreaterThan(0);
  });

  it('accepts a customTheme with both dark and light maps', async () => {
    const errors = await validate(
      makeDto({
        customTheme: {
          dark: { '--mount-border': '#102030' },
          light: { '--mount-border': '#fefefe' },
        },
      }),
    );
    expect(errors).toHaveLength(0);
  });

  it('accepts a customTheme with only a single mode (partial save)', async () => {
    const errors = await validate(
      makeDto({ customTheme: { dark: { '--base-bg': '#000000' } } }),
    );
    expect(errors).toHaveLength(0);
  });

  it('accepts an empty customTheme object', async () => {
    const errors = await validate(makeDto({ customTheme: {} }));
    expect(errors).toHaveLength(0);
  });

  it('rejects a customTheme whose mode map holds a non-string value', async () => {
    const errors = await validate(
      makeDto({
        customTheme: {
          dark: { '--mount-border': 42 as unknown as string },
        },
      }),
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a customTheme mode that is not an object', async () => {
    const errors = await validate(
      makeDto({
        customTheme: {
          dark: 'not-an-object' as unknown as Record<string, string>,
        },
      }),
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a customTheme that is an array, not an object', async () => {
    const errors = await validate(
      makeDto({
        customTheme: [] as unknown as { dark?: Record<string, string> },
      }),
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});
