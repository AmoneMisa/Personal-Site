import test from 'node:test';
import assert from 'node:assert/strict';

const { composeTransform, isIdentityEdit, IDENTITY_TRANSFORM_EDIT } = await import('~/utils/svgTransform');

test('identity edit is detected and composes to just the original transform', () => {
  assert.equal(isIdentityEdit(IDENTITY_TRANSFORM_EDIT), true);
  assert.equal(composeTransform('rotate(5)', IDENTITY_TRANSFORM_EDIT, 10, 10), 'rotate(5)');
  assert.equal(composeTransform('', IDENTITY_TRANSFORM_EDIT, 10, 10), '');
});

test('a pure move produces only a translate, with the original transform preserved after it', () => {
  const edit = { translateX: 12, translateY: -4, scale: 1, rotateDeg: 0 };
  assert.equal(composeTransform('', edit, 0, 0), 'translate(12,-4)');
  assert.equal(composeTransform('scale(2)', edit, 0, 0), 'translate(12,-4) scale(2)');
});

test('scale and rotate are wrapped around the given pivot point', () => {
  const edit = { translateX: 0, translateY: 0, scale: 2, rotateDeg: 90 };
  assert.equal(
    composeTransform('', edit, 5, 5),
    'translate(5,5) rotate(90) scale(2) translate(-5,-5)',
  );
});

test('move + scale + rotate + original all compose in one call, move outermost', () => {
  const edit = { translateX: 10, translateY: 20, scale: 0.5, rotateDeg: -30 };
  const out = composeTransform('translate(1,1)', edit, 3, 4);
  assert.equal(
    out,
    'translate(10,20) translate(3,4) rotate(-30) scale(0.5) translate(-3,-4) translate(1,1)',
  );
});

test('scale must not silently disappear for very small non-1 values', () => {
  const edit = { translateX: 0, translateY: 0, scale: 0.0001, rotateDeg: 0 };
  const out = composeTransform('', edit, 0, 0);
  assert.match(out, /scale\(0\.0001\)/);
});

test('isIdentityEdit is false when only one field differs', () => {
  assert.equal(isIdentityEdit({ translateX: 1, translateY: 0, scale: 1, rotateDeg: 0 }), false);
  assert.equal(isIdentityEdit({ translateX: 0, translateY: 0, scale: 1.01, rotateDeg: 0 }), false);
  assert.equal(isIdentityEdit({ translateX: 0, translateY: 0, scale: 1, rotateDeg: 0.5 }), false);
});
