import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guideLanguage } from '../resources/guide-language.js';
test('first launch follows the phone language, including legacy Hebrew locale', () => {
  for (const language of ['he', 'he-IL', 'he_IL', 'iw-IL']) assert.equal(guideLanguage(null, language), 'he');
  for (const language of ['en', 'en-US', 'en-GB', 'fr-FR', '']) assert.equal(guideLanguage(null, language), 'en');
});
test('an explicit language choice survives subsequent launches', () => {
  assert.equal(guideLanguage('en', 'he-IL'), 'en');
  assert.equal(guideLanguage('he', 'en-US'), 'he');
  assert.equal(guideLanguage('invalid', 'he-IL'), 'he');
});
