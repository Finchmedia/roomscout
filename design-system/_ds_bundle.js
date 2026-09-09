/* @ds-bundle: {"format":4,"namespace":"RoomScoutDesignSystem_e8f376","components":[{"name":"Avatar","sourcePath":"components/core/avatar/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/badge/Badge.jsx"},{"name":"Button","sourcePath":"components/core/button/Button.jsx"},{"name":"Capsule","sourcePath":"components/core/capsule/Capsule.jsx"},{"name":"Card","sourcePath":"components/core/card/Card.jsx"},{"name":"IconButton","sourcePath":"components/core/icon-button/IconButton.jsx"},{"name":"ICON_NAMES","sourcePath":"components/core/icon/Icon.jsx"},{"name":"Icon","sourcePath":"components/core/icon/Icon.jsx"},{"name":"Overline","sourcePath":"components/core/overline/Overline.jsx"},{"name":"ScoutBlob","sourcePath":"components/core/scout-blob/ScoutBlob.jsx"},{"name":"StatusDot","sourcePath":"components/core/status-dot/StatusDot.jsx"},{"name":"SummaryPill","sourcePath":"components/core/summary-pill/SummaryPill.jsx"},{"name":"Wordmark","sourcePath":"components/core/wordmark/Wordmark.jsx"},{"name":"DataTable","sourcePath":"components/data/data-table/DataTable.jsx"},{"name":"FactList","sourcePath":"components/data/fact-list/FactList.jsx"},{"name":"ChatBubble","sourcePath":"components/feedback/chat-bubble/ChatBubble.jsx"},{"name":"Hint","sourcePath":"components/feedback/hint/Hint.jsx"},{"name":"Notice","sourcePath":"components/feedback/notice/Notice.jsx"},{"name":"Toast","sourcePath":"components/feedback/toast/Toast.jsx"},{"name":"Composer","sourcePath":"components/forms/composer/Composer.jsx"},{"name":"RadioCard","sourcePath":"components/forms/radio-card/RadioCard.jsx"},{"name":"Stepper","sourcePath":"components/forms/stepper/Stepper.jsx"},{"name":"Switch","sourcePath":"components/forms/switch/Switch.jsx"},{"name":"TextInput","sourcePath":"components/forms/text-input/TextInput.jsx"},{"name":"VoiceControl","sourcePath":"components/forms/voice-control/VoiceControl.jsx"},{"name":"Accordion","sourcePath":"components/navigation/accordion/Accordion.jsx"},{"name":"AppHeader","sourcePath":"components/navigation/app-header/AppHeader.jsx"},{"name":"NavItem","sourcePath":"components/navigation/nav-item/NavItem.jsx"},{"name":"NavGroupLabel","sourcePath":"components/navigation/nav-item/NavItem.jsx"},{"name":"ProfileMenu","sourcePath":"components/navigation/profile-menu/ProfileMenu.jsx"}],"sourceHashes":{"components/core/avatar/Avatar.jsx":"a00c626a2efd","components/core/badge/Badge.jsx":"006ba39d9137","components/core/button/Button.jsx":"70b11b811152","components/core/capsule/Capsule.jsx":"654c72fb0385","components/core/card/Card.jsx":"0c15bbf68880","components/core/icon-button/IconButton.jsx":"6636d8fc83ac","components/core/icon/Icon.jsx":"01f07b7d35f6","components/core/overline/Overline.jsx":"8071945638a2","components/core/scout-blob/ScoutBlob.jsx":"6c45e272e373","components/core/status-dot/StatusDot.jsx":"c531fb8e01c8","components/core/summary-pill/SummaryPill.jsx":"47ec7ec0dc99","components/core/wordmark/Wordmark.jsx":"14a4dfed9e38","components/data/data-table/DataTable.jsx":"4ba9913c3da7","components/data/fact-list/FactList.jsx":"d39ada3ca7df","components/feedback/chat-bubble/ChatBubble.jsx":"9c9412ebde1b","components/feedback/hint/Hint.jsx":"3e80b304b896","components/feedback/notice/Notice.jsx":"39cd18e86474","components/feedback/toast/Toast.jsx":"1edfe575c309","components/forms/composer/Composer.jsx":"5ef439cc7c0a","components/forms/radio-card/RadioCard.jsx":"f88e95e039bb","components/forms/stepper/Stepper.jsx":"7a13e2cc816d","components/forms/switch/Switch.jsx":"9da039b304b3","components/forms/text-input/TextInput.jsx":"217f11de23b8","components/forms/voice-control/VoiceControl.jsx":"23231892f4fe","components/navigation/accordion/Accordion.jsx":"0eac0ebb0f60","components/navigation/app-header/AppHeader.jsx":"dc23d721a635","components/navigation/nav-item/NavItem.jsx":"e1acb3c9a078","components/navigation/profile-menu/ProfileMenu.jsx":"26c1fc20be6c","ui_kits/landing/Landing.jsx":"bb427b54c84d","ui_kits/roomscout-app/App.jsx":"9819f87f18a3","ui_kits/roomscout-app/Operator.jsx":"da1cdca03ab7","ui_kits/roomscout-app/ScreensA.jsx":"1ce08e90856d","ui_kits/roomscout-app/ScreensB.jsx":"0dd5b1e318e1","ui_kits/roomscout-app/ScreensC.jsx":"4ff7abe3f8d4","ui_kits/roomscout-app/Settings.jsx":"442a08560c16"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.RoomScoutDesignSystem_e8f376 = window.RoomScoutDesignSystem_e8f376 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/avatar/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Initials circle ("HB"). Same outline treatment as header icon buttons. */
function Avatar({
  initials = 'HB',
  size = 42,
  interactive,
  style,
  ...rest
}) {
  const Tag = interactive ? 'button' : 'div';
  return /*#__PURE__*/React.createElement(Tag, _extends({
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      border: '1px solid var(--rs-border-control)',
      background: 'var(--rs-surface-subtle)',
      color: 'var(--rs-ink)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-sans)',
      fontSize: Math.round(size * .31),
      fontWeight: 500,
      padding: 0,
      cursor: interactive ? 'pointer' : 'default',
      flex: 'none',
      ...style
    }
  }, rest), initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/avatar/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/badge/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Small label tag. solid = orange ("Mein Vorschlag"); outline = accent outline uppercase ("INTERN"); muted = neutral outline ("In dieser Demo nicht aktiv"). */
function Badge({
  variant = 'solid',
  children,
  style,
  ...rest
}) {
  const v = {
    solid: {
      padding: '5px 11px',
      borderRadius: 999,
      background: 'var(--rs-orange)',
      color: '#fff',
      fontSize: 12.5,
      fontWeight: 600,
      letterSpacing: '.04em'
    },
    outline: {
      padding: '5px 10px',
      borderRadius: 8,
      border: '1px solid rgba(255,140,90,.6)',
      color: 'var(--rs-orange-light)',
      fontSize: 12,
      letterSpacing: '.12em',
      fontWeight: 600,
      textTransform: 'uppercase'
    },
    muted: {
      padding: '4px 10px',
      borderRadius: 999,
      border: '1px solid var(--rs-border-panel)',
      color: 'var(--rs-ink-6)',
      fontSize: 13
    },
    pill: {
      height: 38,
      padding: '0 18px',
      borderRadius: 999,
      border: '1px solid rgba(255,140,90,.55)',
      color: 'var(--rs-ink)',
      fontSize: 14.5
    }
  }[variant];
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: 'var(--font-sans)',
      whiteSpace: 'nowrap',
      ...v,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/badge/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/button/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const H = {
  lg: 60,
  md: 56,
  base: 50,
  sm: 46,
  xs: 44,
  '2xs': 36
};
const PX = {
  lg: 34,
  md: 32,
  base: 24,
  sm: 22,
  xs: 20,
  '2xs': 14
};
const FS = {
  lg: 19,
  md: 17,
  base: 16,
  sm: 15,
  xs: 15,
  '2xs': 13.5
};

/** Pill button. primary = orange; secondary = outlined translucent; tint = orange-tinted (answer chips); ghost = bare text; link = underlined text; danger = red circle-ish. */
function Button({
  variant = 'primary',
  size = 'base',
  icon,
  children,
  block,
  disabled,
  style,
  hovered,
  ...rest
}) {
  const [hov, setHov] = React.useState(false);
  const h = hovered ?? hov;
  const base = {
    height: H[size],
    padding: `0 ${PX[size]}px`,
    borderRadius: 999,
    border: 0,
    fontFamily: 'var(--font-sans)',
    fontSize: FS[size],
    fontWeight: 600,
    display: block ? 'flex' : 'inline-flex',
    width: block ? '100%' : undefined,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    cursor: disabled ? 'default' : 'pointer',
    transition: 'background .2s,color .2s,transform .2s',
    whiteSpace: 'nowrap',
    opacity: disabled ? .5 : 1
  };
  const v = {
    primary: {
      background: h ? 'var(--rs-orange-hover)' : 'var(--rs-orange)',
      color: '#fff',
      boxShadow: size === 'lg' ? 'var(--shadow-accent-button)' : size === 'md' ? 'var(--shadow-accent-button-sm)' : 'none',
      transform: h && size === 'lg' ? 'translateY(-1px)' : 'none'
    },
    secondary: {
      background: h ? 'var(--rs-surface-hover)' : 'rgba(255,255,255,.05)',
      color: 'var(--rs-ink)',
      border: '1px solid var(--rs-border-control-strong)',
      fontWeight: 500
    },
    tint: {
      background: h ? 'var(--rs-surface-accent-tint-hover)' : 'rgba(255,105,38,.14)',
      color: 'var(--rs-orange-tint-2)',
      border: '1px solid rgba(255,140,90,.45)',
      fontWeight: 500
    },
    ghost: {
      background: 'none',
      color: h ? '#fff' : 'var(--rs-ink-3)',
      fontWeight: 400,
      padding: '8px 12px',
      height: 'auto',
      borderRadius: 8,
      gap: 10
    },
    link: {
      background: 'none',
      color: h ? '#fff' : 'var(--rs-ink-3)',
      fontWeight: 400,
      padding: '8px 12px',
      height: 'auto',
      textDecoration: 'underline',
      textUnderlineOffset: 4,
      textDecorationColor: 'rgba(255,220,190,.35)'
    },
    danger: {
      background: h ? 'var(--rs-red-hover)' : 'var(--rs-red)',
      color: '#fff'
    }
  }[variant];
  return /*#__PURE__*/React.createElement("button", _extends({
    disabled: disabled,
    onMouseEnter: () => setHov(true),
    onMouseLeave: () => setHov(false),
    style: {
      ...base,
      ...v,
      ...style
    }
  }, rest), icon, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/button/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/capsule/Capsule.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Extracted-fact capsule: appears under the current utterance, then glides into the fact list. Orange tint, warm text. */
function Capsule({
  children,
  size = 'md',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      height: size === 'sm' ? 30 : 34,
      padding: size === 'sm' ? '0 12px' : '0 14px',
      borderRadius: 999,
      background: 'var(--rs-surface-accent-tint)',
      border: '1px solid var(--rs-border-accent)',
      color: 'var(--rs-orange-tint)',
      fontFamily: 'var(--font-sans)',
      fontSize: size === 'sm' ? 13 : 14,
      fontWeight: 500,
      whiteSpace: 'nowrap',
      animation: 'rsFadeUp .3s ease both',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Capsule });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/capsule/Capsule.jsx", error: String((e && e.message) || e) }); }

// components/core/card/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const R = {
  sm: 16,
  md: 20,
  lg: 22,
  xl: 24,
  '2xl': 26,
  panel: 28
};
const PAD = {
  sm: '14px 18px',
  md: '24px 26px',
  lg: '34px 36px 30px',
  xl: '28px 36px 30px',
  '2xl': '32px 34px',
  panel: 0
};

/** Dark, slightly translucent card with a very fine warm border. No frosted glass, no glowing frames. tone: default | soft | faint | accent (orange border) | warning (amber). */
function Card({
  size = 'md',
  tone = 'default',
  hoverLift,
  padding,
  children,
  style,
  ...rest
}) {
  const [h, setH] = React.useState(false);
  const bg = {
    default: 'var(--rs-surface-card)',
    soft: 'var(--rs-surface-card-soft)',
    faint: 'var(--rs-surface-card-faint)',
    accent: 'var(--rs-surface-card)',
    warning: 'var(--rs-surface-amber-tint)',
    inset: 'var(--rs-surface-inset)',
    panel: 'var(--rs-surface-panel)',
    rust: 'var(--rs-rust-faint)'
  }[tone];
  const border = {
    default: 'var(--rs-border-card)',
    soft: 'var(--rs-border-card)',
    faint: 'var(--rs-border-card-soft)',
    accent: 'var(--rs-border-accent-faint)',
    warning: 'var(--rs-border-amber)',
    inset: 'var(--rs-border-card)',
    panel: 'var(--rs-border-panel)',
    rust: 'rgba(255,140,90,.22)'
  }[tone];
  return /*#__PURE__*/React.createElement("div", _extends({
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: R[size],
      padding: padding ?? PAD[size],
      fontFamily: 'var(--font-sans)',
      color: 'var(--rs-ink)',
      textAlign: 'left',
      boxShadow: tone === 'panel' ? 'var(--shadow-panel)' : 'none',
      transition: 'transform .3s',
      transform: hoverLift && h ? 'translateY(-3px)' : 'none',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/card/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/icon-button/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Circular icon button. outline = header controls (42px); subtle = filled rgba white; accent = orange (voice entry); bare = no background. */
function IconButton({
  variant = 'outline',
  size = 42,
  children,
  label,
  style,
  ...rest
}) {
  const [h, setH] = React.useState(false);
  const v = {
    outline: {
      background: h ? 'var(--rs-surface-hover)' : 'var(--rs-surface-subtle)',
      border: '1px solid var(--rs-border-control)',
      color: 'var(--rs-ink)'
    },
    subtle: {
      background: h ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.08)',
      border: 0,
      color: 'var(--rs-ink)'
    },
    accent: {
      background: h ? 'var(--rs-orange-hover)' : 'var(--rs-orange)',
      border: 0,
      color: '#fff'
    },
    bare: {
      background: h ? 'rgba(255,255,255,.08)' : 'none',
      border: 0,
      color: 'var(--rs-ink-2)'
    },
    danger: {
      background: h ? 'var(--rs-red-hover)' : 'var(--rs-red)',
      border: 0,
      color: '#fff'
    }
  }[variant];
  return /*#__PURE__*/React.createElement("button", _extends({
    "aria-label": label,
    title: label,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      fontSize: 13,
      fontWeight: 500,
      transition: 'background .2s',
      flex: 'none',
      ...v,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/icon-button/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/icon/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Icon paths lifted verbatim from the RoomScout prototype's inline SVGs (24×24 viewBox, round caps). */
const P = {
  mic: {
    sw: 1.9,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: "9",
      y: "3",
      width: "6",
      height: "11",
      rx: "3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M5 11a7 7 0 0 0 14 0"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 18v3"
    }))
  },
  'mic-off': {
    sw: 1.8,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: "9",
      y: "3",
      width: "6",
      height: "11",
      rx: "3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M5 11a7 7 0 0 0 14 0"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 18v3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M4 4l16 16"
    }))
  },
  keyboard: {
    sw: 1.7,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: "3",
      y: "6",
      width: "18",
      height: "12",
      rx: "2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M7 10h.01M11 10h.01M15 10h.01M7 14h10"
    }))
  },
  send: {
    sw: 1.8,
    d: /*#__PURE__*/React.createElement("path", {
      d: "M4 12l16-8-6 16-2.5-6.5z"
    })
  },
  transcript: {
    sw: 1.7,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: "4",
      y: "5",
      width: "16",
      height: "12",
      rx: "3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M8 10h8M8 13h5"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M9 17l-2 3"
    }))
  },
  close: {
    sw: 2,
    d: /*#__PURE__*/React.createElement("path", {
      d: "M6 6l12 12M18 6L6 18"
    })
  },
  check: {
    sw: 2.2,
    d: /*#__PURE__*/React.createElement("path", {
      d: "M5 12.5l4.5 4.5L19 7.5"
    })
  },
  'chevron-down': {
    sw: 2,
    d: /*#__PURE__*/React.createElement("path", {
      d: "M6 9l6 6 6-6"
    })
  },
  'chevron-up': {
    sw: 2,
    d: /*#__PURE__*/React.createElement("path", {
      d: "M6 15l6-6 6 6"
    })
  },
  'chevron-right': {
    sw: 2,
    d: /*#__PURE__*/React.createElement("path", {
      d: "M9 6l6 6-6 6"
    })
  },
  'arrow-left': {
    sw: 1.8,
    d: /*#__PURE__*/React.createElement("path", {
      d: "M19 12H5M11 6l-6 6 6 6"
    })
  },
  'arrow-up-right': {
    sw: 2,
    d: /*#__PURE__*/React.createElement("path", {
      d: "M7 17L17 7M9 7h8v8"
    })
  },
  pin: {
    sw: 1.6,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "11",
      r: "2"
    }))
  },
  users: {
    sw: 1.6,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "9",
      cy: "8",
      r: "3.2"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "16.5",
      cy: "9",
      r: "2.6"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M3.5 19c.5-3.3 2.6-5 5.5-5s5 1.7 5.5 5"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M15 14.4c2.6 0 4.3 1.5 4.8 4.4"
    }))
  },
  clock: {
    sw: 1.6,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "8.5"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 7.5V12l3 2"
    }))
  },
  drum: {
    sw: 1.6,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("ellipse", {
      cx: "12",
      cy: "8",
      rx: "8",
      ry: "3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M4 8v8c0 1.7 3.6 3 8 3s8-1.3 8-3V8"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M8 10.5v8M16 10.5v8"
    }))
  },
  search: {
    sw: 1.8,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "11",
      cy: "11",
      r: "6.5"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M20 20l-4.2-4.2"
    }))
  },
  list: {
    sw: 1.8,
    d: /*#__PURE__*/React.createElement("path", {
      d: "M5 7h14M5 12h14M5 17h9"
    })
  },
  edit: {
    sw: 1.7,
    d: /*#__PURE__*/React.createElement("path", {
      d: "M4 20l4-.8L19.5 7.7a1.8 1.8 0 0 0-2.6-2.6L5.3 16.6z"
    })
  },
  pause: {
    sw: 2.2,
    d: /*#__PURE__*/React.createElement("path", {
      d: "M9 6v12M15 6v12"
    })
  },
  play: {
    fill: true,
    d: /*#__PURE__*/React.createElement("path", {
      d: "M8 5.5v13l10-6.5z"
    })
  },
  restart: {
    sw: 2,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M4 12a8 8 0 1 0 2.5-5.8"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M4 4v5h5"
    }))
  },
  sliders: {
    sw: 1.7,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M4 7h10M18 7h2M4 17h4M12 17h8"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "16",
      cy: "7",
      r: "2"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "10",
      cy: "17",
      r: "2"
    }))
  },
  globe: {
    sw: 1.6,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "8.5"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17"
    }))
  },
  doc: {
    sw: 1.6,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M6 3h9l4 4v14H6z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M9 12h6M9 16h6"
    }))
  },
  user: {
    sw: 1.6,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "8.5",
      r: "3.8"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M4.5 20c.8-3.8 3.7-6 7.5-6s6.7 2.2 7.5 6"
    }))
  },
  bell: {
    sw: 1.6,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2H4.5z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10 20a2 2 0 0 0 4 0"
    }))
  },
  card: {
    sw: 1.6,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: "3",
      y: "6",
      width: "18",
      height: "12",
      rx: "2.5"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M3 10h18"
    }))
  },
  shield: {
    sw: 1.6,
    d: /*#__PURE__*/React.createElement("path", {
      d: "M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"
    })
  },
  lock: {
    sw: 1.8,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: "5",
      y: "11",
      width: "14",
      height: "10",
      rx: "2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M8 11V8a4 4 0 0 1 8 0v3"
    }))
  },
  building: {
    sw: 1.6,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M4 21V5h9v16M13 9h7v12"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M7 9h3M7 13h3M7 17h3M16 13h1M16 17h1"
    }))
  },
  home: {
    sw: 1.6,
    d: /*#__PURE__*/React.createElement("path", {
      d: "M4 11l8-7 8 7v9H4z"
    })
  },
  mail: {
    sw: 1.5,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: "3",
      y: "5",
      width: "18",
      height: "14",
      rx: "2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M3 7l9 6 9-6"
    }))
  },
  bars: {
    fill: true,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: "4",
      y: "13",
      width: "4",
      height: "7",
      rx: "1"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "10",
      y: "8",
      width: "4",
      height: "12",
      rx: "1"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "16",
      y: "4",
      width: "4",
      height: "16",
      rx: "1"
    }))
  },
  database: {
    sw: 1.6,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("ellipse", {
      cx: "12",
      cy: "6",
      rx: "8",
      ry: "3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"
    }))
  },
  tasks: {
    sw: 1.6,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: "5",
      y: "4",
      width: "14",
      height: "17",
      rx: "2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M9 4h6v3H9z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M8.5 13l2 2 4-4"
    }))
  },
  plug: {
    sw: 1.6,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M9 3v4M15 3v4"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M6 7h12v4a6 6 0 0 1-12 0z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 17v4"
    }))
  },
  flag: {
    sw: 1.6,
    d: /*#__PURE__*/React.createElement("path", {
      d: "M5 21V4h11l-1.5 3.5L16 11H5"
    })
  },
  pulse: {
    sw: 1.6,
    d: /*#__PURE__*/React.createElement("path", {
      d: "M3 12h4l3-7 4 14 3-7h4"
    })
  },
  music: {
    sw: 1.6,
    d: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M9 18V6l10-2v12"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "6.5",
      cy: "18",
      r: "2.5"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "16.5",
      cy: "16",
      r: "2.5"
    }))
  },
  plus: {
    sw: 2,
    d: /*#__PURE__*/React.createElement("path", {
      d: "M5 12h14M12 5v14"
    })
  },
  minus: {
    sw: 2,
    d: /*#__PURE__*/React.createElement("path", {
      d: "M5 12h14"
    })
  }
};
const ICON_NAMES = Object.keys(P);

/** Stroke icon from the RoomScout set. Inherits currentColor. */
function Icon({
  name,
  size = 18,
  strokeWidth,
  color,
  style,
  ...rest
}) {
  const p = P[name] || P.close;
  const fill = p.fill;
  return /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: fill ? 'currentColor' : 'none',
    stroke: fill ? 'none' : 'currentColor',
    strokeWidth: strokeWidth || p.sw || 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      flex: 'none',
      color,
      ...style
    },
    "aria-hidden": "true"
  }, rest), p.d);
}
Object.assign(__ds_scope, { ICON_NAMES, Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/icon/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/overline/Overline.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Uppercase, letter-spaced section label. muted (default) or accent ("ANGEBOT EINGEGANGEN"). */
function Overline({
  tone = 'muted',
  wide,
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 12.5,
      letterSpacing: wide ? '.18em' : tone === 'accent' ? '.16em' : '.14em',
      textTransform: 'uppercase',
      fontWeight: tone === 'accent' ? 500 : 400,
      color: tone === 'accent' ? 'var(--rs-orange-light)' : 'var(--rs-ink-6)',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Overline });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/overline/Overline.jsx", error: String((e && e.message) || e) }); }

// components/core/scout-blob/ScoutBlob.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const ANIM = {
  idle: 'rsBreathe 5.2s ease-in-out infinite',
  speaking: 'rsSpeak 1.6s ease-in-out infinite',
  listening: 'rsListen 3.2s ease-in-out infinite',
  still: 'none'
};

/** The Scout: an organic orange blob with a soft local glow. Never boxed into a card. */
function ScoutBlob({
  size = 168,
  state = 'idle',
  glow = true,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    "aria-hidden": "true",
    style: {
      width: size,
      height: size,
      flex: 'none',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: '100%',
      borderRadius: 'var(--blob-shape)',
      background: 'var(--blob-gradient)',
      boxShadow: glow ? size < 80 ? 'var(--shadow-blob-sm)' : 'var(--shadow-blob)' : 'none',
      animation: ANIM[state] || ANIM.idle,
      transition: 'box-shadow .6s'
    }
  }));
}
Object.assign(__ds_scope, { ScoutBlob });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/scout-blob/ScoutBlob.jsx", error: String((e && e.message) || e) }); }

// components/core/status-dot/StatusDot.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const C = {
  accent: 'var(--rs-orange)',
  success: 'var(--rs-green)',
  warning: 'var(--rs-amber)',
  muted: 'var(--rs-ink-6)',
  neutral: 'var(--rs-ink-2)'
};

/** Colored dot + short status text. Used for "Scout ist unterwegs", source status, integration health. pulse = slow opacity blink. */
function StatusDot({
  tone = 'accent',
  pulse,
  children,
  size = 8,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      fontFamily: 'var(--font-sans)',
      fontSize: 14.5,
      color: 'var(--rs-ink-2)',
      whiteSpace: 'nowrap',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      background: C[tone] || tone,
      flex: 'none',
      animation: pulse ? 'rsDot 2.4s ease-in-out infinite' : 'none'
    }
  }), children);
}
Object.assign(__ds_scope, { StatusDot });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/status-dot/StatusDot.jsx", error: String((e && e.message) || e) }); }

// components/core/summary-pill/SummaryPill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Dark translucent pill that summarises the brief ("Stuttgart · bis 350 €"). Optional leading icon and trailing chevron; clickable to expand. */
function SummaryPill({
  icon,
  chevron,
  open,
  children,
  size = 'md',
  onClick,
  style,
  ...rest
}) {
  const [h, setH] = React.useState(false);
  const hgt = {
    sm: 36,
    md: 44,
    lg: 50
  }[size];
  const Tag = onClick ? 'button' : 'div';
  return /*#__PURE__*/React.createElement(Tag, _extends({
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      height: hgt,
      padding: size === 'lg' ? '0 20px' : '0 16px',
      borderRadius: 999,
      border: '1px solid var(--rs-border-card-strong)',
      background: h && onClick ? 'rgba(30,22,16,.7)' : 'var(--rs-surface-pill)',
      color: size === 'lg' ? 'var(--rs-ink)' : 'var(--rs-ink-2)',
      fontFamily: 'var(--font-sans)',
      fontSize: size === 'lg' ? 16 : 14.5,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      cursor: onClick ? 'pointer' : 'default',
      whiteSpace: 'nowrap',
      ...style
    }
  }, rest), icon, children, chevron && /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "14",
    height: "14",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    style: {
      transform: open ? 'rotate(180deg)' : 'none',
      transition: 'transform .3s'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M6 9l6 6 6-6"
  })));
}
Object.assign(__ds_scope, { SummaryPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/summary-pill/SummaryPill.jsx", error: String((e && e.message) || e) }); }

// components/core/wordmark/Wordmark.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Plain lowercase wordmark. No logo, no cube icon in the product UI. */
function Wordmark({
  size = 20,
  color = 'var(--rs-ink)',
  as = 'div',
  href,
  style,
  ...rest
}) {
  const s = {
    fontFamily: 'var(--font-sans)',
    fontSize: size,
    fontWeight: 500,
    letterSpacing: '.04em',
    color,
    textDecoration: 'none',
    lineHeight: 1,
    ...style
  };
  if (href) return /*#__PURE__*/React.createElement("a", _extends({
    href: href,
    style: s
  }, rest), "roomscout");
  return React.createElement(as, {
    style: s,
    ...rest
  }, 'roomscout');
}
Object.assign(__ds_scope, { Wordmark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/wordmark/Wordmark.jsx", error: String((e && e.message) || e) }); }

// components/data/data-table/DataTable.jsx
try { (() => {
/** Light operator table: muted header row, hairline dividers, no zebra. columns: [{key, label, width}] ; rows: array of objects (values may be React nodes). */
function DataTable({
  columns = [],
  rows = [],
  style
}) {
  const cols = columns.map(c => c.width || '1fr').join(' ');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      color: 'var(--rs-ink)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: cols,
      gap: 12,
      padding: '10px 14px',
      fontSize: 14,
      color: 'var(--rs-ink-6)',
      borderBottom: '1px solid var(--rs-border-divider)'
    }
  }, columns.map(c => /*#__PURE__*/React.createElement("span", {
    key: c.key
  }, c.label))), rows.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'grid',
      gridTemplateColumns: cols,
      gap: 12,
      alignItems: 'center',
      padding: '12px 14px',
      borderBottom: '1px solid var(--rs-border-divider-soft)',
      fontSize: 16,
      background: r._highlight ? 'rgba(224,161,58,.06)' : 'none',
      borderRadius: 10
    }
  }, columns.map(c => /*#__PURE__*/React.createElement("span", {
    key: c.key,
    style: {
      color: c.muted ? 'var(--rs-ink-4)' : 'inherit'
    }
  }, r[c.key])))));
}
Object.assign(__ds_scope, { DataTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/data-table/DataTable.jsx", error: String((e && e.message) || e) }); }

// components/data/fact-list/FactList.jsx
try { (() => {
const ICON = {
  ort: 'pin',
  budget: null,
  band: 'users',
  zeit: 'clock',
  equip: 'drum'
};

/** "Euer Suchauftrag": the brief as a list of facts with quiet icons. floating = light group next to the conversation; card = central review card; compact = inline expansion. */
function FactList({
  facts = [],
  variant = 'floating',
  title = 'Euer Suchauftrag',
  onEdit,
  editing,
  drafts = {},
  onDraftChange,
  children,
  style
}) {
  const card = variant === 'card';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: card ? 'min(520px,100%)' : variant === 'compact' ? 'min(380px,100%)' : 300,
      padding: card ? '26px 28px 28px' : variant === 'compact' ? '14px 18px' : '14px 16px',
      borderRadius: card ? 26 : 16,
      background: card ? 'rgba(18,14,12,.78)' : variant === 'compact' ? 'var(--rs-surface-card)' : 'rgba(18,14,12,.5)',
      border: `1px solid ${card ? 'var(--rs-border-panel)' : 'var(--rs-border-card-soft)'}`,
      boxShadow: card ? 'var(--shadow-card-float)' : 'none',
      textAlign: 'left',
      display: 'flex',
      flexDirection: 'column',
      gap: card ? 4 : 2,
      fontFamily: 'var(--font-sans)',
      color: 'var(--rs-ink)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: card ? 10 : 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: card ? {
      fontSize: 21
    } : {
      fontSize: 11.5,
      letterSpacing: '.09em',
      textTransform: 'uppercase',
      color: 'var(--rs-ink-6)'
    }
  }, title), onEdit && !editing && /*#__PURE__*/React.createElement("button", {
    onClick: onEdit,
    "aria-label": "Suchauftrag bearbeiten",
    style: {
      width: 36,
      height: 36,
      borderRadius: '50%',
      border: 0,
      background: 'none',
      color: 'var(--rs-ink-2)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "edit",
    size: 18
  }))), facts.map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: card ? 14 : 12,
      height: card ? 44 : 34,
      padding: '0 6px',
      borderRadius: 8,
      fontSize: card ? 17 : 14,
      borderBottom: card ? '1px solid var(--rs-border-divider-soft)' : 0,
      background: f.changed ? 'rgba(255,105,38,.18)' : 'transparent',
      transition: 'background .5s',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 22,
      height: 22,
      flex: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--rs-ink-2)'
    }
  }, f.id === 'budget' ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 19,
      lineHeight: 1
    }
  }, "\u20AC") : ICON[f.id] ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: ICON[f.id],
    size: card ? 20 : 18
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'var(--rs-orange-light)'
    }
  })), editing ? /*#__PURE__*/React.createElement("input", {
    value: drafts[f.id] !== undefined ? drafts[f.id] : f.label,
    onChange: e => onDraftChange && onDraftChange(f.id, e.target.value),
    "aria-label": "Kriterium bearbeiten",
    style: {
      flex: 1,
      minWidth: 0,
      background: 'rgba(255,255,255,.06)',
      border: '1px solid rgba(255,200,160,.25)',
      borderRadius: 8,
      color: 'var(--rs-ink)',
      fontFamily: 'inherit',
      fontSize: 16,
      padding: '6px 10px',
      outline: 'none'
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, f.label))), children);
}
Object.assign(__ds_scope, { FactList });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/fact-list/FactList.jsx", error: String((e && e.message) || e) }); }

// components/feedback/chat-bubble/ChatBubble.jsx
try { (() => {
/** Conversation bubble. user = right-aligned rust bubble with a tail; scout = left-aligned bare text (no bubble). transcript variant boxes both. */
function ChatBubble({
  who = 'user',
  children,
  label,
  compact,
  style
}) {
  const user = who === 'user';
  const base = {
    fontFamily: 'var(--font-sans)',
    color: 'var(--rs-ink)',
    textAlign: 'left',
    animation: 'rsFadeUp .35s ease both',
    maxWidth: '80%'
  };
  if (user) return /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: 'flex-end',
      ...base,
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--rs-ink-6)',
      marginBottom: 4,
      textAlign: 'right'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: compact ? '10px 14px' : '14px 20px',
      borderRadius: '18px 18px 4px 18px',
      background: 'var(--rs-rust)',
      border: '1px solid var(--rs-border-accent-soft)',
      fontSize: compact ? 15 : 17,
      lineHeight: 1.45
    }
  }, children));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: 'flex-start',
      ...base,
      maxWidth: '85%',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--rs-ink-6)',
      marginBottom: 4
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: compact ? {
      padding: '10px 14px',
      borderRadius: '18px 18px 18px 4px',
      background: 'rgba(255,255,255,.05)',
      fontSize: 15,
      lineHeight: 1.45
    } : {
      fontSize: 18,
      lineHeight: 1.5,
      padding: '6px 4px'
    }
  }, children));
}
Object.assign(__ds_scope, { ChatBubble });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/chat-bubble/ChatBubble.jsx", error: String((e && e.message) || e) }); }

// components/feedback/hint/Hint.jsx
try { (() => {
/** Quiet bottom-centre note outside the conversation (e.g. pointing to prepared demo answers). */
function Hint({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    style: {
      display: 'inline-block',
      maxWidth: 560,
      padding: '10px 16px',
      borderRadius: 12,
      background: 'var(--rs-surface-hint)',
      border: '1px solid rgba(255,200,160,.2)',
      fontFamily: 'var(--font-sans)',
      fontSize: 13.5,
      color: 'var(--rs-ink-2)',
      textAlign: 'center',
      animation: 'rsFadeUp .3s ease both',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Hint });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/hint/Hint.jsx", error: String((e && e.message) || e) }); }

// components/feedback/notice/Notice.jsx
try { (() => {
/** Inline notice bar. warning = amber (stale offer, expired access); success = green dot; neutral = subtle. Optional inline action rendered after the text. */
function Notice({
  tone = 'warning',
  children,
  action,
  style
}) {
  const t = {
    warning: {
      bg: 'var(--rs-surface-amber-tint)',
      border: 'var(--rs-border-amber)',
      dot: 'var(--rs-amber)'
    },
    success: {
      bg: 'rgba(255,255,255,.03)',
      border: 'var(--rs-border-card-soft)',
      dot: 'var(--rs-green)'
    },
    neutral: {
      bg: 'rgba(255,255,255,.03)',
      border: 'var(--rs-border-card-soft)',
      dot: 'var(--rs-ink-6)'
    },
    accent: {
      bg: 'var(--rs-rust-faint)',
      border: 'rgba(255,140,90,.22)',
      dot: 'var(--rs-orange)'
    }
  }[tone];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 16px',
      borderRadius: 12,
      background: t.bg,
      border: `1px solid ${t.border}`,
      fontFamily: 'var(--font-sans)',
      fontSize: 14,
      color: 'var(--rs-ink)',
      flexWrap: 'wrap',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: t.dot,
      flex: 'none'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, children), action);
}
Object.assign(__ds_scope, { Notice });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/notice/Notice.jsx", error: String((e && e.message) || e) }); }

// components/feedback/toast/Toast.jsx
try { (() => {
/** Event notification with a primary action ("Zum Scout") and dismiss. Appears top-right while another area is open. */
function Toast({
  children,
  actionLabel = 'Zum Scout',
  onAction,
  onDismiss,
  style
}) {
  const [h, setH] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 14,
      padding: '12px 12px 12px 16px',
      borderRadius: 14,
      background: 'var(--rs-surface-toast)',
      border: '1px solid var(--rs-border-accent-soft)',
      boxShadow: 'var(--shadow-toast)',
      fontFamily: 'var(--font-sans)',
      color: 'var(--rs-ink)',
      animation: 'rsFadeUp .25s ease both',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--rs-orange)',
      flex: 'none'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14.5
    }
  }, children), onAction && /*#__PURE__*/React.createElement("button", {
    onClick: onAction,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      height: 34,
      padding: '0 14px',
      borderRadius: 999,
      border: 0,
      background: h ? 'var(--rs-orange-hover)' : 'var(--rs-orange)',
      color: '#fff',
      fontFamily: 'inherit',
      fontSize: 13.5,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, actionLabel), onDismiss && /*#__PURE__*/React.createElement("button", {
    onClick: onDismiss,
    "aria-label": "Schlie\xDFen",
    style: {
      width: 30,
      height: 30,
      borderRadius: '50%',
      border: 0,
      background: 'none',
      color: 'var(--rs-ink-6)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "14",
    height: "14",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M6 6l12 12M18 6L6 18"
  }))));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/toast/Toast.jsx", error: String((e && e.message) || e) }); }

// components/forms/composer/Composer.jsx
try { (() => {
/** Pill-shaped message composer: keyboard icon · input · send · (optional) orange voice button. */
function Composer({
  value,
  onChange,
  onSubmit,
  onVoice,
  placeholder = 'Nachricht an deinen Scout …',
  label = 'Nachricht an deinen Scout',
  height = 60,
  showKeyboardIcon = true,
  divider,
  style
}) {
  return /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      onSubmit && onSubmit(value);
    },
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height,
      padding: '0 8px 0 18px',
      borderRadius: 999,
      background: 'var(--rs-surface-composer)',
      border: '1px solid var(--rs-border-panel)',
      backdropFilter: 'var(--blur-composer)',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, showKeyboardIcon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "keyboard",
    size: 20,
    color: "var(--rs-ink-6)"
  }), divider && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      height: 22,
      background: 'var(--rs-border-panel)'
    }
  }), /*#__PURE__*/React.createElement("input", {
    value: value,
    onChange: e => onChange && onChange(e.target.value),
    placeholder: placeholder,
    "aria-label": label,
    style: {
      flex: 1,
      minWidth: 0,
      background: 'none',
      border: 0,
      color: 'var(--rs-ink)',
      fontFamily: 'inherit',
      fontSize: 16,
      outline: 'none',
      padding: '0 6px'
    }
  }), onSubmit && /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    type: "submit",
    variant: "subtle",
    size: height - 16,
    label: "Senden"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "send",
    size: 18
  })), onVoice && /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    type: "button",
    variant: "accent",
    size: height - 16,
    label: "Mit Scout sprechen",
    onClick: onVoice
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "mic",
    size: 18
  })));
}
Object.assign(__ds_scope, { Composer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/composer/Composer.jsx", error: String((e && e.message) || e) }); }

// components/forms/radio-card/RadioCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Large radio option rendered as a card (Autopilot / Mit Rücksprache). */
function RadioCard({
  checked,
  onSelect,
  title,
  description,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    role: "radio",
    "aria-checked": !!checked,
    onClick: onSelect,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      padding: '20px 22px',
      borderRadius: 16,
      border: `1px solid ${checked ? 'rgba(255,140,90,.55)' : 'var(--rs-border-card)'}`,
      background: checked ? 'rgba(255,105,38,.1)' : 'rgba(255,255,255,.03)',
      color: 'var(--rs-ink)',
      fontFamily: 'var(--font-sans)',
      textAlign: 'left',
      cursor: 'pointer',
      transition: 'background .2s,border-color .2s',
      width: '100%',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 26,
      height: 26,
      borderRadius: '50%',
      border: `2px solid ${checked ? 'var(--rs-orange)' : 'rgba(255,220,190,.35)'}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: checked ? 'var(--rs-orange)' : 'transparent'
    }
  })), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 19,
      fontWeight: 500
    }
  }, title), description && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginTop: 3,
      fontSize: 15,
      color: 'var(--rs-ink-4)'
    }
  }, description)));
}
Object.assign(__ds_scope, { RadioCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/radio-card/RadioCard.jsx", error: String((e && e.message) || e) }); }

// components/forms/stepper/Stepper.jsx
try { (() => {
/** −/+ number stepper (40px tall, 10px radius). */
function Stepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label,
  style
}) {
  const [h, setH] = React.useState(null);
  const btn = k => ({
    width: 42,
    height: 40,
    border: 0,
    background: h === k ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.05)',
    color: 'var(--rs-ink)',
    fontFamily: 'var(--font-sans)',
    fontSize: 18,
    cursor: 'pointer'
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      border: '1px solid rgba(255,220,190,.2)',
      borderRadius: 10,
      overflow: 'hidden',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", {
    "aria-label": "Weniger",
    onMouseEnter: () => setH('d'),
    onMouseLeave: () => setH(null),
    onClick: () => onChange && onChange(Math.max(min, value - 1)),
    style: btn('d')
  }, "\u2212"), /*#__PURE__*/React.createElement("input", {
    value: value,
    onChange: e => onChange && onChange(e.target.value),
    inputMode: "numeric",
    "aria-label": label,
    style: {
      width: 56,
      height: 40,
      textAlign: 'center',
      border: 0,
      background: 'none',
      color: 'var(--rs-ink)',
      fontFamily: 'inherit',
      fontSize: 17,
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement("button", {
    "aria-label": "Mehr",
    onMouseEnter: () => setH('i'),
    onMouseLeave: () => setH(null),
    onClick: () => onChange && onChange(Math.min(max, value + 1)),
    style: btn('i')
  }, "+"));
}
Object.assign(__ds_scope, { Stepper });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/stepper/Stepper.jsx", error: String((e && e.message) || e) }); }

// components/forms/switch/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** 56×32 toggle. Orange when on, subtle white when off. */
function Switch({
  checked,
  onChange,
  label,
  disabled,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    role: "switch",
    "aria-checked": !!checked,
    "aria-label": label,
    disabled: disabled,
    onClick: () => onChange && onChange(!checked),
    style: {
      width: 56,
      height: 32,
      borderRadius: 16,
      border: 0,
      padding: 0,
      background: checked ? 'var(--rs-orange)' : 'rgba(255,255,255,.14)',
      position: 'relative',
      cursor: disabled ? 'default' : 'pointer',
      transition: 'background .2s',
      flex: 'none',
      opacity: disabled ? .5 : 1,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 3,
      left: 3,
      width: 26,
      height: 26,
      borderRadius: '50%',
      background: '#fff',
      transform: checked ? 'translateX(24px)' : 'none',
      transition: 'transform .2s',
      boxShadow: 'var(--shadow-knob)'
    }
  }));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/switch/Switch.jsx", error: String((e && e.message) || e) }); }

// components/forms/text-input/TextInput.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Rectangular settings input (46px, 12px radius, inset dark). invalid = red helper text. */
function TextInput({
  value,
  onChange,
  placeholder,
  label,
  invalid,
  helper,
  style,
  inputStyle,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    value: value,
    onChange: e => onChange && onChange(e.target.value),
    placeholder: placeholder,
    "aria-label": label,
    "aria-invalid": !!invalid,
    style: {
      width: '100%',
      height: 46,
      padding: '0 16px',
      borderRadius: 12,
      border: `1px solid ${invalid ? 'rgba(255,138,106,.6)' : 'var(--rs-border-panel)'}`,
      background: 'var(--rs-surface-inset)',
      color: 'var(--rs-ink)',
      fontFamily: 'inherit',
      fontSize: 15,
      outline: 'none',
      ...inputStyle
    }
  }, rest)), helper && /*#__PURE__*/React.createElement("div", {
    role: invalid ? 'alert' : undefined,
    style: {
      marginTop: 8,
      fontSize: 14,
      color: invalid ? 'var(--rs-red-text)' : 'var(--rs-ink-6)'
    }
  }, helper));
}
Object.assign(__ds_scope, { TextInput });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/text-input/TextInput.jsx", error: String((e && e.message) || e) }); }

// components/forms/voice-control/VoiceControl.jsx
try { (() => {
/** Large labelled circular control for the live conversation (Mikro an/aus · Mitschrift · Gespräch beenden). */
function VoiceControl({
  tone = 'neutral',
  size = 76,
  label,
  children,
  active,
  onClick,
  style
}) {
  const [h, setH] = React.useState(false);
  const circle = {
    neutral: {
      background: h ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.07)',
      border: '1px solid var(--rs-border-panel)',
      color: 'var(--rs-ink)'
    },
    accent: {
      background: active === false ? 'rgba(255,255,255,.07)' : h ? 'var(--rs-orange-hover)' : 'var(--rs-orange)',
      border: active === false ? '1px solid var(--rs-border-panel)' : '1px solid transparent',
      color: '#fff',
      boxShadow: active === false ? 'none' : '0 0 0 6px rgba(255,105,38,.12)'
    },
    danger: {
      background: h ? 'var(--rs-red-hover)' : 'var(--rs-red)',
      border: 0,
      color: '#fff'
    }
  }[tone];
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      border: 0,
      background: 'none',
      color: 'var(--rs-ink-2)',
      fontFamily: 'var(--font-sans)',
      fontSize: 14,
      cursor: 'pointer',
      padding: 0,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background .3s',
      ...circle
    }
  }, children), label);
}
Object.assign(__ds_scope, { VoiceControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/voice-control/VoiceControl.jsx", error: String((e && e.message) || e) }); }

// components/navigation/accordion/Accordion.jsx
try { (() => {
/** FAQ-style accordion item: question row with a circled +/− toggle; the answer slides via grid-template-rows. */
function Accordion({
  question,
  children,
  defaultOpen = false,
  style
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 18,
      border: `1px solid ${open ? 'var(--rs-border-accent-faint)' : 'var(--rs-border-card)'}`,
      background: 'var(--rs-surface-card-faint)',
      transition: 'border-color .3s',
      fontFamily: 'var(--font-sans)',
      color: 'var(--rs-ink)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpen(o => !o),
    "aria-expanded": open,
    style: {
      width: '100%',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 20,
      padding: '22px 26px',
      border: 0,
      background: 'none',
      color: 'inherit',
      fontFamily: 'inherit',
      fontSize: 'clamp(18px,1.5vw,22px)',
      textAlign: 'left',
      cursor: 'pointer',
      borderRadius: 18
    }
  }, /*#__PURE__*/React.createElement("span", null, question), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 36,
      height: 36,
      borderRadius: '50%',
      border: '1px solid var(--rs-border-control-strong)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 'none',
      transition: 'transform .3s',
      transform: open ? 'rotate(180deg)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "16",
    height: "16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M5 12h14"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 5v14",
    style: {
      opacity: open ? 0 : 1,
      transition: 'opacity .2s'
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateRows: open ? '1fr' : '0fr',
      transition: 'grid-template-rows .32s cubic-bezier(.3,.7,.2,1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: 'hidden',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 26px 24px',
      fontSize: 16,
      lineHeight: 1.6,
      color: 'var(--rs-ink-4)'
    }
  }, children))));
}
Object.assign(__ds_scope, { Accordion });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/accordion/Accordion.jsx", error: String((e && e.message) || e) }); }

// components/navigation/app-header/AppHeader.jsx
try { (() => {
/** App header: wordmark left, optional status + controls + avatar right. 84px tall (64 narrow). */
function AppHeader({
  narrow,
  initials = 'HB',
  right,
  onAvatar,
  style
}) {
  const h = narrow ? 64 : 84;
  return /*#__PURE__*/React.createElement("header", {
    style: {
      height: h,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: narrow ? '0 18px' : '0 36px',
      flex: 'none',
      fontFamily: 'var(--font-sans)',
      color: 'var(--rs-ink)',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Wordmark, {
    size: narrow ? 17 : 20
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: narrow ? 10 : 14
    }
  }, right, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    initials: initials,
    size: narrow ? 38 : 42,
    interactive: !!onAvatar,
    onClick: onAvatar,
    "aria-label": "Profilmen\xFC"
  })));
}
Object.assign(__ds_scope, { AppHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/app-header/AppHeader.jsx", error: String((e && e.message) || e) }); }

// components/navigation/nav-item/NavItem.jsx
try { (() => {
/** Settings / operator sidebar item: 50px, 12px radius, icon + label. current = subtle fill + warm border. */
function NavItem({
  icon,
  current,
  children,
  onClick,
  style
}) {
  const [h, setH] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    "aria-current": current ? 'page' : undefined,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      height: 50,
      padding: '0 14px',
      borderRadius: 12,
      border: `1px solid ${current ? 'var(--rs-border-card-strong)' : 'transparent'}`,
      background: current ? 'rgba(255,255,255,.07)' : h ? 'rgba(255,255,255,.06)' : 'none',
      color: 'var(--rs-ink)',
      fontFamily: 'var(--font-sans)',
      fontSize: 16,
      cursor: 'pointer',
      textAlign: 'left',
      width: '100%',
      transition: 'background .15s',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 22,
      height: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: current ? 'var(--rs-orange-light)' : 'var(--rs-ink-2)'
    }
  }, icon), children);
}

/** Small uppercase group label used above NavItem groups ("Dein Scout", "Dein Konto"). */
function NavGroupLabel({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '28px 10px 10px',
      fontFamily: 'var(--font-sans)',
      fontSize: 12,
      letterSpacing: '.14em',
      textTransform: 'uppercase',
      color: 'var(--rs-ink-6)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { NavItem, NavGroupLabel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/nav-item/NavItem.jsx", error: String((e && e.message) || e) }); }

// components/navigation/profile-menu/ProfileMenu.jsx
try { (() => {
/** Profile dropdown anchored under the avatar. items: [{label, icon, onClick}]. */
function ProfileMenu({
  name = 'Herzbuben',
  subtitle = 'Persönlicher Bereich',
  items = [],
  style
}) {
  const [h, setH] = React.useState(null);
  return /*#__PURE__*/React.createElement("div", {
    role: "menu",
    style: {
      minWidth: 240,
      padding: 8,
      borderRadius: 16,
      background: 'var(--rs-surface-menu)',
      border: '1px solid var(--rs-border-panel)',
      boxShadow: 'var(--shadow-menu)',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      fontFamily: 'var(--font-sans)',
      color: 'var(--rs-ink)',
      animation: 'rsFadeUp .18s ease both',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 12px 8px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 500
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--rs-ink-6)'
    }
  }, subtitle)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--rs-border-divider)',
      margin: '2px 4px 6px'
    }
  }), items.map((it, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    role: "menuitem",
    onClick: it.onClick,
    onMouseEnter: () => setH(i),
    onMouseLeave: () => setH(null),
    style: {
      textAlign: 'left',
      border: 0,
      background: h === i ? 'var(--rs-surface-hover-soft)' : 'none',
      color: 'var(--rs-ink)',
      fontFamily: 'inherit',
      fontSize: 15,
      padding: '10px 12px',
      borderRadius: 10,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, it.icon, it.label)));
}
Object.assign(__ds_scope, { ProfileMenu });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/profile-menu/ProfileMenu.jsx", error: String((e && e.message) || e) }); }

// ui_kits/landing/Landing.jsx
try { (() => {
const LDS = window.RoomScoutDesignSystem_e8f376;
const {
  ScoutBlob: LBlob,
  Button: LBtn,
  Badge: LBadge,
  Overline: LOvl,
  Card: LCard,
  Icon: LIc,
  Accordion: LAcc,
  Wordmark: LMark,
  Capsule: LCap,
  FactList: LFacts,
  SummaryPill: LPill,
  StatusDot: LDot
} = LDS;
const FAQS = [['Was darf der Scout selbstständig tun?', 'Er recherchiert und fragt unverbindlich an — innerhalb eures Suchauftrags. Verbindliche Zusagen, Buchungen und Zahlungen entscheidet ihr selbst. Quellen, Handlungsspielraum und Erinnerungen könnt ihr in den Einstellungen prüfen und ändern.'], ['Muss ich mit dem Scout sprechen?', 'Nein. Ihr könnt sprechen oder schreiben. Beides gehört zur selben Suche.'], ['Funktioniert das schon auf allen Portalen?', 'Noch nicht. Die aktuelle Demo zeigt den Ablauf auf einem von uns kontrollierten Testportal. In dieser Demo kontaktieren wir keine fremden Anbieter.']];
const FACTS = [{
  id: 'ort',
  label: 'Stuttgart & Umgebung'
}, {
  id: 'band',
  label: 'Geteilter Raum · 4 Personen'
}, {
  id: 'budget',
  label: 'Bis 350 € / Monat',
  changed: true
}, {
  id: 'equip',
  label: 'Schlagzeug darf im Raum bleiben'
}, {
  id: 'zeit',
  label: 'Donnerstags ab 19 Uhr'
}];
const CHECK = /*#__PURE__*/React.createElement(LIc, {
  name: "check",
  size: 18,
  color: "var(--rs-orange)"
});
const H2 = ({
  children,
  style
}) => /*#__PURE__*/React.createElement("h2", {
  style: {
    margin: '18px 0 0',
    fontSize: 'clamp(36px,5vw,68px)',
    lineHeight: 1.04,
    fontWeight: 400,
    letterSpacing: '-.03em',
    textWrap: 'balance',
    ...style
  }
}, children);
const BentoTitle = ({
  t,
  s
}) => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 'clamp(22px,1.9vw,27px)',
    fontWeight: 500,
    letterSpacing: '-.01em'
  }
}, t), /*#__PURE__*/React.createElement("div", {
  style: {
    marginTop: 6,
    fontSize: 16,
    color: 'var(--rs-ink-4)'
  }
}, s));
function Landing() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      color: 'var(--rs-ink)',
      position: 'relative',
      minHeight: '100vh'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "rs-bg"
  }), /*#__PURE__*/React.createElement("div", {
    className: "rs-grain"
  })), /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'fixed',
      zIndex: 10,
      top: 0,
      left: 0,
      right: 0,
      height: 76,
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      padding: '0 clamp(20px,4vw,48px)',
      background: 'rgba(11,10,9,.55)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--rs-border-divider-soft)'
    }
  }, /*#__PURE__*/React.createElement(LMark, {
    size: 19,
    href: "#top",
    style: {
      justifySelf: 'start'
    }
  }), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      gap: 34,
      fontSize: 15
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#how",
    style: {
      color: 'var(--rs-ink-2)',
      textDecoration: 'none'
    }
  }, "So funktioniert\u2019s"), /*#__PURE__*/React.createElement("a", {
    href: "#features",
    style: {
      color: 'var(--rs-ink-2)',
      textDecoration: 'none'
    }
  }, "Dein Scout")), /*#__PURE__*/React.createElement("a", {
    href: "../roomscout-app/index.html",
    style: {
      justifySelf: 'end',
      height: 44,
      padding: '0 22px',
      borderRadius: 999,
      background: 'var(--rs-orange)',
      color: '#fff',
      fontSize: 15,
      fontWeight: 600,
      textDecoration: 'none',
      display: 'flex',
      alignItems: 'center'
    }
  }, "Demo starten")), /*#__PURE__*/React.createElement("section", {
    id: "top",
    style: {
      position: 'relative',
      zIndex: 2,
      padding: '130px 24px 40px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement(LBadge, {
    variant: "pill"
  }, "Euer pers\xF6nlicher Proberaum-Scout"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: '26px 0 0',
      fontSize: 'clamp(42px,6.2vw,84px)',
      lineHeight: 1.02,
      fontWeight: 400,
      letterSpacing: '-.03em',
      textWrap: 'balance'
    }
  }, "Ihr macht Musik.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--rs-orange)'
    }
  }, "Der Scout sucht den Raum.")), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '24px 0 0',
      fontSize: 'clamp(17px,1.5vw,21px)',
      lineHeight: 1.5,
      color: 'var(--rs-ink-4)',
      maxWidth: 600,
      textWrap: 'pretty'
    }
  }, "Erz\xE4hlt, was ihr sucht. RoomScout \xFCbernimmt die Suche und kl\xE4rt mit Anbietern, ob der Raum zu euch passt."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 34,
      display: 'flex',
      alignItems: 'center',
      gap: 26,
      flexWrap: 'wrap',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "../roomscout-app/index.html",
    style: {
      textDecoration: 'none'
    }
  }, /*#__PURE__*/React.createElement(LBtn, {
    size: "md",
    style: {
      fontSize: 17
    }
  }, "Demo ausprobieren")), /*#__PURE__*/React.createElement("a", {
    href: "#how",
    style: {
      fontSize: 16,
      color: 'var(--rs-ink)',
      textDecoration: 'none'
    }
  }, "So funktioniert\u2019s \u2193")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      fontSize: 13.5,
      color: 'var(--rs-ink-6)'
    }
  }, "Fr\xFCher Prototyp \xB7 Kontrollierte Demo"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 44,
      width: 'min(1120px,100%)',
      perspective: 1600,
      perspectiveOrigin: '50% 0%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      borderRadius: 22,
      border: '1px solid rgba(255,190,140,.26)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-hero)',
      transform: 'rotateX(14deg) scale(.96)',
      transformOrigin: '50% 0%'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/hero-preview.png",
    alt: "Beispielansicht der RoomScout-App",
    style: {
      display: 'block',
      width: '100%',
      height: 'auto'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(180deg,rgba(11,10,9,0) 70%,rgba(11,10,9,.35) 100%)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 18,
      bottom: 14,
      fontSize: 12,
      color: 'var(--rs-ink-2)',
      padding: '5px 11px',
      borderRadius: 999,
      border: '1px solid var(--rs-border-control)',
      background: 'rgba(11,10,9,.55)'
    }
  }, "Beispielansicht")))), /*#__PURE__*/React.createElement("section", {
    id: "how",
    style: {
      position: 'relative',
      zIndex: 2,
      padding: '120px clamp(20px,5vw,80px) 0',
      maxWidth: 1400,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)',
      gap: 40,
      alignItems: 'end'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(LOvl, {
    tone: "accent",
    wide: true
  }, "So funktioniert RoomScout"), /*#__PURE__*/React.createElement(H2, {
    style: {
      fontSize: 'clamp(36px,5.4vw,74px)',
      lineHeight: 1.02
    }
  }, "Ein Gespr\xE4ch.", /*#__PURE__*/React.createElement("br", null), "Dann \xFCbernimmt euer Scout.")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'clamp(17px,1.4vw,20px)',
      color: 'var(--rs-ink-4)',
      lineHeight: 1.5,
      paddingBottom: 10
    }
  }, "Von euren W\xFCnschen bis zum konkreten Angebot.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 70,
      display: 'grid',
      gridTemplateColumns: 'auto minmax(0,1fr) auto',
      gap: 'clamp(24px,4vw,60px)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 22
    }
  }, /*#__PURE__*/React.createElement(LBlob, {
    size: 140,
    state: "listening"
  }), /*#__PURE__*/React.createElement(LDot, {
    pulse: true,
    style: {
      fontSize: 14,
      color: 'var(--rs-ink-6)'
    }
  }, "Ich h\xF6re zu")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 22,
      minWidth: 0
    }
  }, [['Wir sind zu viert und suchen einen geteilten Proberaum in Stuttgart.', ['Stuttgart & Umgebung', 'Geteilter Raum · 4 Personen']], ['Bis 400 Euro im Monat. Unser Schlagzeug soll dort bleiben können.', ['Bis 400 € / Monat', 'Schlagzeug darf im Raum bleiben']], ['Eigentlich lieber maximal 350 Euro.', ['Bis 350 € / Monat']]].map(([t, caps]) => /*#__PURE__*/React.createElement("div", {
    key: t
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--rs-ink-6)',
      marginBottom: 4
    }
  }, "Du"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'clamp(17px,2.2vw,30px)',
      lineHeight: 1.2,
      fontWeight: 300,
      letterSpacing: '-.015em',
      textWrap: 'balance'
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, caps.map(c => /*#__PURE__*/React.createElement(LCap, {
    key: c,
    size: "sm"
  }, c)))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(LFacts, {
    facts: FACTS
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      fontSize: 14,
      color: 'var(--rs-ink-6)',
      lineHeight: 1.5,
      maxWidth: 300
    }
  }, "W\xE4hrend ihr sprecht, merke ich mir, was z\xE4hlt. Korrekturen ersetzen den alten Wert.")))), /*#__PURE__*/React.createElement("section", {
    style: {
      position: 'relative',
      zIndex: 2,
      padding: '140px 24px 0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement(LBlob, {
    size: 150,
    style: {
      marginBottom: 44
    }
  }), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: 'clamp(34px,5vw,64px)',
      lineHeight: 1.05,
      fontWeight: 300,
      letterSpacing: '-.025em'
    }
  }, "Ich k\xFCmmere mich darum."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22,
      fontSize: 'clamp(17px,1.6vw,22px)',
      color: 'var(--rs-ink-2)',
      maxWidth: 560
    }
  }, "Die Anfrage ist raus. Ich warte auf eine Antwort."), /*#__PURE__*/React.createElement(LPill, {
    style: {
      marginTop: 26,
      height: 42,
      color: 'var(--rs-ink-2)'
    }
  }, "Stuttgart \xB7 bis 350 \u20AC"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 50,
      fontSize: 15,
      color: 'var(--rs-ink-6)',
      maxWidth: 460,
      lineHeight: 1.6
    }
  }, "Ihr k\xF6nnt die App schlie\xDFen. Ich melde mich, wenn ich euch brauche.")), /*#__PURE__*/React.createElement("section", {
    style: {
      position: 'relative',
      zIndex: 2,
      padding: '140px 24px 0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement(LBlob, {
    size: 96,
    state: "listening",
    style: {
      marginBottom: 32
    }
  }), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: 'clamp(32px,4.6vw,58px)',
      lineHeight: 1.05,
      fontWeight: 300,
      letterSpacing: '-.025em',
      textWrap: 'balance'
    }
  }, "Nur echte Entscheidungen kommen zu euch."), /*#__PURE__*/React.createElement(LCard, {
    size: "lg",
    tone: "soft",
    style: {
      marginTop: 34,
      width: 'min(680px,100%)',
      padding: '30px 32px',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement(LOvl, null, "Dein Scout"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      fontSize: 'clamp(21px,2.3vw,29px)',
      lineHeight: 1.25,
      fontWeight: 300,
      textWrap: 'balance'
    }
  }, "Ein Raum passt zu euch. Donnerstag ist schon belegt \u2014 w\xE4re Mittwoch ab 19 Uhr auch m\xF6glich?"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22,
      display: 'flex',
      gap: 10,
      justifyContent: 'center',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(LBtn, {
    variant: "tint",
    size: "xs"
  }, "Mittwoch passt"), /*#__PURE__*/React.createElement(LBtn, {
    variant: "secondary",
    size: "xs"
  }, "Donnerstag bleibt wichtig")))), /*#__PURE__*/React.createElement("section", {
    style: {
      position: 'relative',
      zIndex: 2,
      padding: '140px 24px 0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '0 0 30px',
      fontSize: 'clamp(32px,4.6vw,58px)',
      lineHeight: 1.05,
      fontWeight: 300,
      letterSpacing: '-.025em'
    }
  }, "Ein Raum, der zu euch passt."), /*#__PURE__*/React.createElement(LCard, {
    size: "xl",
    padding: 0,
    style: {
      width: 'min(1100px,100%)',
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,1fr)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/proberaum.png",
    alt: "Proberaum mit Schlagzeug und Akustikpaneelen",
    style: {
      display: 'block',
      width: '100%',
      height: '100%',
      minHeight: 300,
      maxHeight: 440,
      objectFit: 'cover'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'clamp(24px,3vw,44px) clamp(24px,3.4vw,52px)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(LOvl, {
    tone: "accent"
  }, "Beispielangebot"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      fontSize: 'clamp(22px,2.2vw,30px)'
    }
  }, "Stuttgart-West \xB7 Geteilter Proberaum"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 'clamp(36px,3.6vw,50px)',
      letterSpacing: '-.02em',
      lineHeight: 1.1
    }
  }, "280 \u20AC ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '.6em',
      color: 'var(--rs-ink-2)'
    }
  }, "/ Monat")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4,
      fontSize: 16,
      color: 'var(--rs-ink-4)'
    }
  }, "inklusive Nebenkosten"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 9,
      fontSize: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, CHECK, "Mittwochs, 19\u201322 Uhr"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, CHECK, "Schlagzeug kann im Raum bleiben")), /*#__PURE__*/React.createElement(LBtn, {
    size: "base",
    style: {
      marginTop: 26,
      alignSelf: 'flex-start',
      padding: '0 30px'
    }
  }, "Angebot pr\xFCfen"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      fontSize: 14.5,
      color: 'var(--rs-ink-4)'
    }
  }, "Eine verbindliche Zusage gebt nur ihr."))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22,
      fontSize: 13,
      color: 'var(--rs-ink-6)'
    }
  }, "Beispielsuche \xB7 Ablauf verk\xFCrzt dargestellt")), /*#__PURE__*/React.createElement("section", {
    id: "features",
    style: {
      position: 'relative',
      zIndex: 2,
      padding: '140px clamp(20px,5vw,80px) 40px',
      maxWidth: 1400,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(LOvl, {
    tone: "accent",
    wide: true
  }, "Mehr als eine Trefferliste"), /*#__PURE__*/React.createElement(H2, null, "Ein Scout, der euch versteht.", /*#__PURE__*/React.createElement("br", null), "Und dranbleibt."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '16px 0 0',
      fontSize: 'clamp(17px,1.4vw,20px)',
      color: 'var(--rs-ink-4)'
    }
  }, "Eure W\xFCnsche, eure Gespr\xE4che und eure Suche bleiben zusammen."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 40,
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(LCard, {
    size: "2xl",
    tone: "soft",
    hoverLift: true,
    padding: 0,
    style: {
      overflow: 'hidden',
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) minmax(0,.8fr)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '32px 34px',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(BentoTitle, {
    t: "Merkt sich, was euch wichtig ist.",
    s: "Auch wenn sich eure W\xFCnsche \xE4ndern."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      border: '1px solid var(--rs-border-card)',
      borderRadius: 16,
      background: 'var(--rs-surface-inset)',
      padding: '14px 18px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 12,
      color: 'var(--rs-ink-6)',
      letterSpacing: '.1em',
      textTransform: 'uppercase'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Eure W\xFCnsche"), /*#__PURE__*/React.createElement("span", {
    style: {
      letterSpacing: 0,
      textTransform: 'none'
    }
  }, "Heute")), [['users', 'Geteilter Raum · 4 Personen'], ['drum', 'Schlagzeug darf bleiben']].map(([i, t]) => /*#__PURE__*/React.createElement("div", {
    key: t,
    style: {
      marginTop: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      height: 46,
      borderTop: '1px solid var(--rs-border-divider-soft)',
      fontSize: 15.5
    }
  }, /*#__PURE__*/React.createElement(LIc, {
    name: i,
    size: 20,
    color: "var(--rs-ink-2)"
  }), t)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      height: 46,
      borderTop: '1px solid var(--rs-border-divider-soft)',
      fontSize: 15.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 19,
      width: 20,
      textAlign: 'center'
    }
  }, "\u20AC"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--rs-ink-6)',
      textDecoration: 'line-through'
    }
  }, "400 \u20AC"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--rs-orange-light)',
      fontWeight: 500
    }
  }, "350 \u20AC / Monat")))), /*#__PURE__*/React.createElement("img", {
    src: "../../assets/proberaum.png",
    alt: "",
    style: {
      display: 'block',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      minHeight: 280
    }
  })), /*#__PURE__*/React.createElement(LCard, {
    size: "2xl",
    tone: "soft",
    hoverLift: true
  }, /*#__PURE__*/React.createElement(BentoTitle, {
    t: "Bleibt an Antworten dran.",
    s: "Ihr m\xFCsst nicht jedes Portal selbst pr\xFCfen."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '44px 1fr',
      gap: 12,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 44,
      height: 44,
      borderRadius: '50%',
      background: 'var(--rs-surface-subtle-2)',
      border: '1px solid var(--rs-border-card)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--rs-ink-2)'
    }
  }, /*#__PURE__*/React.createElement(LIc, {
    name: "building",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px',
      borderRadius: 14,
      background: 'rgba(255,255,255,.05)',
      border: '1px solid var(--rs-border-divider)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 12.5,
      color: 'var(--rs-ink-6)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Anbieter"), /*#__PURE__*/React.createElement("span", null, "Heute, 14:27")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4,
      fontSize: 15.5
    }
  }, "Mittwoch w\xE4re noch frei."))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '44px 1fr',
      gap: 12,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(LBlob, {
    size: 44,
    state: "still"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px',
      borderRadius: 14,
      background: 'var(--rs-rust-soft)',
      border: '1px solid var(--rs-border-accent-faint)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--rs-orange-light)'
    }
  }, "RoomScout"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--rs-ink-6)'
    }
  }, "Heute, 14:28")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4,
      fontSize: 15.5
    }
  }, "Passt Mittwoch f\xFCr euch?")))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.5fr)',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(LCard, {
    size: "2xl",
    tone: "soft",
    hoverLift: true,
    style: {
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(BentoTitle, {
    t: "Beh\xE4lt eure Quellen im Blick.",
    s: "Passende Anzeigen an einem Ort."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      position: 'relative',
      height: 170
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: 'min(300px,78%)',
      display: 'grid',
      gridTemplateColumns: '96px 1fr',
      gap: 12,
      padding: 10,
      borderRadius: 14,
      background: 'rgba(0,0,0,.35)',
      border: '1px solid var(--rs-border-panel)'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/proberaum.png",
    alt: "",
    style: {
      width: 96,
      height: 78,
      objectFit: 'cover',
      borderRadius: 8
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14.5
    }
  }, "Angebot \xB7 Stuttgart-West"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      height: 6,
      borderRadius: 3,
      background: 'rgba(255,255,255,.12)',
      width: '80%'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      height: 6,
      borderRadius: 3,
      background: 'rgba(255,255,255,.12)',
      width: '60%'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 'min(150px,40%)',
      top: 58,
      width: 'min(240px,62%)',
      padding: '12px 14px',
      borderRadius: 14,
      background: 'rgba(10,8,7,.9)',
      border: '1px solid var(--rs-border-card)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14.5,
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(LIc, {
    name: "doc",
    size: 16
  }), "Gesuch \xB7 Band sucht Raum"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      height: 6,
      borderRadius: 3,
      background: 'rgba(255,255,255,.12)',
      width: '70%'
    }
  })), /*#__PURE__*/React.createElement(LPill, {
    size: "sm",
    icon: /*#__PURE__*/React.createElement(LIc, {
      name: "pin",
      size: 16
    }),
    style: {
      position: 'absolute',
      left: 0,
      bottom: 0,
      height: 40
    }
  }, "Stuttgart"))), /*#__PURE__*/React.createElement(LCard, {
    size: "2xl",
    tone: "soft",
    hoverLift: true,
    style: {
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: -40,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 220,
      height: 220,
      borderRadius: 'var(--blob-shape)',
      background: 'var(--blob-gradient)',
      boxShadow: '0 0 60px 10px rgba(255,105,38,.35)',
      opacity: .9,
      animation: 'rsBreathe 6s ease-in-out infinite'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      maxWidth: '66%'
    }
  }, /*#__PURE__*/React.createElement(BentoTitle, {
    t: "\xDCbernimmt Arbeit. Nicht eure Entscheidung.",
    s: "Anfragen laufen im Autopilot. Verbindliche Zusagen bleiben bei euch."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      border: '1px solid var(--rs-border-card)',
      borderRadius: 16,
      background: 'rgba(0,0,0,.3)',
      padding: '6px 18px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '36px 1fr',
      gap: 14,
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid var(--rs-border-divider-soft)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 34,
      height: 34,
      borderRadius: '50%',
      background: 'var(--rs-orange)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement(LIc, {
    name: "check",
    size: 16,
    strokeWidth: 2.4
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15.5
    }
  }, "Anbieter kontaktieren"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: 'var(--rs-ink-6)'
    }
  }, "Darf RoomScout f\xFCr euch \xFCbernehmen."))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '36px 1fr',
      gap: 14,
      alignItems: 'center',
      padding: '12px 0'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 34,
      height: 34,
      borderRadius: '50%',
      border: '1px solid rgba(255,220,190,.25)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(LIc, {
    name: "lock",
    size: 15
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15.5
    }
  }, "Verbindlich zusagen"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: 'var(--rs-ink-6)'
    }
  }, "Bleibt immer bei euch.")))))))), /*#__PURE__*/React.createElement("section", {
    id: "control",
    style: {
      position: 'relative',
      zIndex: 2,
      padding: '110px clamp(20px,5vw,80px) 40px',
      maxWidth: 1400,
      margin: '0 auto',
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)',
      gap: 'clamp(30px,5vw,80px)',
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(LOvl, {
    tone: "accent",
    wide: true
  }, "Klar geregelt"), /*#__PURE__*/React.createElement(H2, {
    style: {
      fontSize: 'clamp(32px,3.8vw,54px)',
      lineHeight: 1.06
    }
  }, "Euer Scout \xFCbernimmt.", /*#__PURE__*/React.createElement("br", null), "Ihr behaltet das letzte Wort."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '22px 0 0',
      fontSize: 17,
      lineHeight: 1.6,
      color: 'var(--rs-ink-4)',
      maxWidth: 460
    }
  }, "Ihr bestimmt, wo gesucht wird, was der Scout \xFCbernehmen darf und was er sich merkt.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, FAQS.map(([q, a], i) => /*#__PURE__*/React.createElement(LAcc, {
    key: q,
    question: q,
    defaultOpen: i === 0
  }, a)))), /*#__PURE__*/React.createElement("section", {
    style: {
      position: 'relative',
      zIndex: 2,
      padding: '100px 24px 0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: 'var(--rs-ink-4)'
    }
  }, "Aktuell: kontrollierte Demo. Keine Anfragen an fremde Anbieter."), /*#__PURE__*/React.createElement(LBlob, {
    size: 86,
    style: {
      marginTop: 44
    }
  }), /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: '34px 0 0',
      fontSize: 'clamp(36px,5vw,66px)',
      lineHeight: 1.04,
      fontWeight: 300,
      letterSpacing: '-.03em',
      textWrap: 'balance'
    }
  }, "Bereit f\xFCr euren n\xE4chsten Proberaum?"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 34,
      display: 'flex',
      alignItems: 'center',
      gap: 26,
      flexWrap: 'wrap',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "../roomscout-app/index.html",
    style: {
      textDecoration: 'none'
    }
  }, /*#__PURE__*/React.createElement(LBtn, {
    size: "md",
    style: {
      height: 58,
      fontSize: 17
    }
  }, "Demo ausprobieren")), /*#__PURE__*/React.createElement("a", {
    href: "https://github.com/Finchmedia/roomscout",
    target: "_blank",
    rel: "noopener",
    style: {
      fontSize: 16,
      color: 'var(--rs-ink)',
      textDecoration: 'none'
    }
  }, "Projekt ansehen \u2197")), /*#__PURE__*/React.createElement("footer", {
    style: {
      marginTop: 90,
      width: 'min(1400px,100%)',
      padding: '26px clamp(20px,5vw,80px) 30px',
      borderTop: '1px solid var(--rs-border-divider)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap',
      fontSize: 14,
      color: 'var(--rs-ink-6)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(LMark, {
    size: 17
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      height: 18,
      background: 'rgba(255,220,190,.2)'
    }
  }), /*#__PURE__*/React.createElement("span", null, "Ein pers\xF6nlicher Scout f\xFCr eure Proberaumsuche.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "https://github.com/Finchmedia/roomscout",
    target: "_blank",
    rel: "noopener",
    style: {
      color: 'var(--rs-ink-2)',
      textDecoration: 'none'
    }
  }, "GitHub"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13
    }
  }, "Entstanden beim Convex All Gas Hackathon.")))));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(Landing, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/landing/Landing.jsx", error: String((e && e.message) || e) }); }

// ui_kits/roomscout-app/App.jsx
try { (() => {
const DS0 = window.RoomScoutDesignSystem_e8f376;
const {
  AppHeader,
  StatusDot: HDot,
  IconButton: HBtn,
  Icon: HIc,
  ProfileMenu,
  Toast: HToast,
  Hint: HHint,
  ChatBubble: HBubble
} = DS0;
const FINAL_FACTS = [{
  id: 'ort',
  label: 'Stuttgart'
}, {
  id: 'budget',
  label: 'Bis 350 € / Monat'
}, {
  id: 'band',
  label: 'Geteilter Raum · 4 Personen'
}, {
  id: 'zeit',
  label: 'Donnerstags ab 19 Uhr'
}, {
  id: 'equip',
  label: 'Schlagzeug darf im Raum bleiben'
}];
const SOURCES0 = [{
  id: 'roomscout',
  name: 'roomscout.dev',
  region: 'Stuttgart',
  enabled: true,
  access: 'connected',
  kind: 'portal',
  lastAccess: null
}, {
  id: 'musiker',
  name: 'Musiker in deiner Stadt',
  region: 'Stuttgart',
  enabled: true,
  access: 'public',
  kind: 'public'
}, {
  id: 'bandnet',
  name: 'Bandnet Hamburg',
  region: 'Hamburg',
  enabled: false,
  access: 'public',
  kind: 'public'
}];
const RULES0 = {
  mode: 'autopilot',
  contact: true,
  viewings: true,
  publishAd: false,
  shareProfile: true,
  sharePrivate: false,
  perDay: 5
};
const KNOW0 = [{
  id: 'k_genre',
  cat: 'band',
  text: 'Hardrock und Alternative',
  origin: 'Demo-Bandprofil',
  status: 'confirmed'
}, {
  id: 'k_mates',
  cat: 'band',
  text: 'Ähnliche Musikrichtung bei Mitnutzern wichtig',
  origin: 'Annahme deines Scouts',
  status: 'assumed'
}, {
  id: 'k_amps',
  cat: 'ausstattung',
  text: 'Verstärker bringt ihr selbst mit',
  origin: 'Aus dem Gespräch',
  status: 'confirmed'
}];
const FACT_CAT = {
  ort: 'alltag',
  budget: 'band',
  band: 'band',
  zeit: 'alltag',
  equip: 'ausstattung'
};
const CHAPTERS = [['welcome', '1 · Willkommen'], ['discovery', '2 · Gespräch'], ['brief', '3 · Suchauftrag'], ['scouting', '4 · Autopilot'], ['clarification', '5 · Rückfrage'], ['dead_end', '5b · Sackgasse'], ['candidates', '5c · Kandidaten'], ['offer', '6 · Angebot'], ['offer_review', '7 · Prüfung'], ['complete', '8 · Abschluss']];
const now = () => {
  const d = new Date();
  return 'Heute, ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
};
function App() {
  const [stage, setStage] = React.useState('welcome');
  const [mode, setMode] = React.useState('voice');
  const [facts, setFacts] = React.useState([]);
  const [transcript, setTranscript] = React.useState([]);
  const [transcriptOpen, setTranscriptOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const [view, setView] = React.useState('scout');
  const [settingsPage, setSettingsPage] = React.useState('sources');
  const [opPage, setOpPage] = React.useState('overview');
  const [toast, setToast] = React.useState(null);
  const [hint, setHint] = React.useState(null);
  const [mobile, setMobile] = React.useState(false);
  const [name, setName] = React.useState('Herzbuben');
  const [sources, setSources] = React.useState(SOURCES0);
  const [autoSources, setAutoSources] = React.useState(true);
  const [rules, setRules] = React.useState(RULES0);
  const [flags, setFlags] = React.useState({
    voice: true,
    publicSearch: false
  });
  const [knowledge, setKnowledge] = React.useState(KNOW0);
  const [knowledgeLog, setKnowledgeLog] = React.useState([]);
  const [notif, setNotif] = React.useState({
    decision: true,
    offer: true,
    digest: false,
    channel: 'app'
  });
  const [incident, setIncident] = React.useState(false);
  const [incidentResolved, setIncidentResolved] = React.useState(false);
  const [offer, setOffer] = React.useState(CANDS[0]);
  const [offerStale, setOfferStale] = React.useState(false);
  const [ap, setAp] = React.useState({
    kind: 'start'
  });
  const [status, setStatus] = React.useState('');
  const [activity, setActivity] = React.useState([]);
  const [pending, setPending] = React.useState(null);
  const [waitingFor, setWaitingFor] = React.useState(null);
  const hintT = React.useRef(null);
  const showHint = t => {
    setHint(t);
    clearTimeout(hintT.current);
    hintT.current = setTimeout(() => setHint(null), 4200);
  };
  const addActivity = a => setActivity(x => x.some(y => y.text === a.text) ? x : x.concat([a]));
  const logChange = text => setKnowledgeLog(l => l.concat([{
    text,
    when: now()
  }]));
  const notify = text => {
    if (view !== 'scout') setToast(text);
  };
  const isAutopilot = stage === 'scouting';
  const go = (next, opts = {}) => {
    if (opts.reset) {
      setFacts([]);
      setTranscript([]);
      setActivity([]);
      setPending(null);
      setWaitingFor(null);
      setOffer(CANDS[0]);
      setOfferStale(false);
      setPaused(false);
    }
    if (opts.mode) setMode(opts.mode);
    if (['brief', 'scouting', 'clarification', 'dead_end', 'candidates', 'offer', 'offer_review', 'complete'].includes(next) && facts.length === 0) setFacts(FINAL_FACTS);
    if (next === 'scouting' && stage !== 'scouting' && !['clarification', 'dead_end', 'candidates'].includes(stage)) {
      setAp({
        kind: 'start'
      });
      setActivity([ACT.start]);
      setPending(null);
      setWaitingFor(null);
    }
    if (next === 'clarification') notify('Dein Scout hat eine Rückfrage');
    if (next === 'dead_end') notify('Dein Scout braucht eine Entscheidung');
    if (next === 'candidates') notify('Dein Scout hat Räume zum Vergleichen');
    if (next === 'offer') notify('Ein Angebot ist eingegangen');
    setStage(next);
    setMenuOpen(false);
  };
  const openSettings = p => {
    setView('settings');
    if (p) setSettingsPage(p);
    setMenuOpen(false);
    setTranscriptOpen(false);
    if (isAutopilot && pending) setToast('Dein Scout wartet auf deine Freigabe');
  };
  const backToScout = () => {
    setView('scout');
    setToast(null);
    setMenuOpen(false);
  };
  const setAccess = (id, access) => {
    setSources(s => s.map(x => x.id === id ? {
      ...x,
      access,
      lastAccess: access === 'connected' ? now() : x.lastAccess
    } : x));
    if (incident && access === 'connected') setIncidentResolved(true);
    if (waitingFor === 'access' && access === 'connected') {
      setWaitingFor(null);
      setAp({
        kind: 'retry'
      });
    }
  };
  const toggleSource = id => {
    setSources(s => s.map(x => x.id === id ? {
      ...x,
      enabled: !x.enabled
    } : x));
    if (waitingFor === 'source') {
      setWaitingFor(null);
      setAp({
        kind: 'retry'
      });
    }
  };
  const updateFact = (id, label) => {
    setFacts(f => f.map(x => x.id === id ? {
      ...x,
      label,
      changed: true
    } : x));
    if (['offer', 'offer_review'].includes(stage)) setOfferStale(true);
    logChange('Angabe korrigiert: ' + label);
    setTimeout(() => setFacts(f => f.map(x => ({
      ...x,
      changed: false
    }))), 1200);
  };
  const knowledgeItems = facts.map(f => ({
    id: 'f_' + f.id,
    factId: f.id,
    cat: FACT_CAT[f.id],
    text: f.label,
    origin: 'Aus dem Gespräch · Teil eures Suchauftrags',
    status: 'confirmed'
  })).concat(knowledge.filter(k => k.id !== 'k_amps' || facts.some(f => f.id === 'equip')));
  const summary = (() => {
    const f = id => facts.find(x => x.id === id);
    const band = f('band'),
      ort = f('ort'),
      eq = f('equip');
    if (!band && !ort && !eq) return 'Ich weiß noch nichts über euch. Erzähl es mir beim nächsten Gespräch.';
    let s = 'Ihr seid eine ' + (band && /4|vier/i.test(band.label) ? 'vierköpfige ' : '') + 'Band' + (ort ? ' aus ' + ort.label.replace(/ & Umland/, '') : '') + '.';
    const p = [];
    if (band) p.push('sucht einen ' + (/geteilt/i.test(band.label) ? 'geteilten ' : '') + 'Proberaum');
    if (eq && /schlagzeug/i.test(eq.label)) p.push('möchtet euer Schlagzeug dort lassen');
    if (p.length) s += ' Ihr ' + p.join(' und ') + '.';
    return s;
  })();
  const inFlow = ['scouting', 'clarification', 'dead_end', 'candidates', 'offer', 'offer_review', 'complete'].includes(stage);
  const hasOrder = facts.length > 0 && !['welcome', 'discovery'].includes(stage);
  const settingsData = {
    name,
    sources,
    autoSources,
    rules,
    flags,
    knowledge: knowledgeItems,
    knowledgeLog,
    summary,
    notif,
    hasOrder,
    usage: {
      searches: inFlow ? 1 : 0,
      contacted: activity.some(a => a.text === ACT.contacted.text) ? 1 : 0
    }
  };
  const settingsActions = {
    back: backToScout,
    toggleSource,
    setAutoSources,
    setAccess,
    saveRules: r => {
      setRules(r);
      logChange('Handlungsspielraum aktualisiert');
      if (pending && r.mode === 'autopilot' && r.contact) {
        setPending(null);
        setWaitingFor(null);
        setAp({
          kind: 'contact'
        });
      }
    },
    setName,
    setNotif,
    updateKnowledge: (id, text) => {
      const k = knowledgeItems.find(x => x.id === id);
      if (k && k.factId) updateFact(k.factId, text);else {
        setKnowledge(ks => ks.map(x => x.id === id ? {
          ...x,
          text
        } : x));
        logChange('Angabe korrigiert: ' + text);
      }
    },
    updateKnowledgeStatus: (id, status) => {
      setKnowledge(ks => ks.map(x => x.id === id ? {
        ...x,
        status
      } : x));
      const k = knowledge.find(x => x.id === id);
      if (k) logChange((status === 'retired' ? 'Nicht mehr verwendet: ' : status === 'confirmed' ? 'Bestätigt: ' : '') + k.text);
    },
    addKnowledge: items => {
      setKnowledge(ks => ks.concat(items));
      logChange(items.length + ' Angaben aus Beispiel-Kontext übernommen');
    }
  };
  const opData = {
    sources,
    flags,
    incident,
    incidentResolved,
    contacted: activity.some(a => a.text === ACT.contacted.text)
  };
  const opActions = {
    setFlags,
    setAccess,
    renewLogin: () => setAccess('roomscout', 'connected')
  };
  const loadIncident = () => {
    setIncident(true);
    setIncidentResolved(false);
    setSources(s => s.map(x => x.id === 'roomscout' ? {
      ...x,
      access: 'expired'
    } : x));
    setView('operator');
    setOpPage('overview');
    setMenuOpen(false);
  };
  const S = {
    welcome: Welcome,
    discovery: Discovery,
    brief: Brief,
    scouting: Autopilot,
    clarification: Clarification,
    dead_end: DeadEnd,
    candidates: Candidates,
    offer: Offer,
    offer_review: Review,
    complete: Complete
  }[stage];
  const screenProps = {
    go,
    name,
    narrow: mobile,
    mode,
    setMode,
    facts,
    setFacts,
    transcript,
    setTranscript,
    toggleTranscript: () => setTranscriptOpen(o => !o),
    paused,
    showHint,
    voiceOff: !flags.voice,
    ap,
    setAp,
    status,
    setStatus,
    activity,
    addActivity,
    rules,
    sources,
    flags,
    pending,
    setPending,
    waitingFor,
    setWaitingFor,
    openSettings,
    offer,
    setOffer,
    offerStale,
    logChange
  };
  const narrow = mobile;
  const session = isAutopilot ? paused ? 'Suche pausiert' : 'Scout ist unterwegs' : null;
  const stageFrame = mobile ? {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 390,
    height: 'min(844px, calc(100% - 32px))',
    transform: 'translate(-50%,-50%)',
    borderRadius: 44,
    border: '1px solid rgba(255,220,190,.2)'
  } : {
    position: 'absolute',
    inset: 0
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      overflow: 'hidden',
      fontFamily: 'var(--font-sans)',
      color: 'var(--rs-ink)',
      background: 'var(--surface-page)'
    },
    onClick: () => menuOpen && setMenuOpen(false)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...stageFrame,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--surface-page)',
      transition: 'width .4s,height .4s,border-radius .4s'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "rs-bg"
  }), /*#__PURE__*/React.createElement("div", {
    className: "rs-grain"
  }), view !== 'operator' && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 12,
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement(AppHeader, {
    narrow: narrow,
    initials: name === 'Herzbuben' ? 'HB' : name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    onAvatar: e => {
      e.stopPropagation();
      setMenuOpen(o => !o);
    },
    right: isAutopilot && view === 'scout' ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(HDot, {
      pulse: !paused,
      tone: paused ? 'muted' : 'accent'
    }, narrow ? '' : paused ? 'Suche pausiert' : 'Scout ist unterwegs'), /*#__PURE__*/React.createElement(HBtn, {
      size: narrow ? 38 : 42,
      label: paused ? 'Suche fortsetzen' : 'Suche pausieren',
      onClick: () => setPaused(p => !p)
    }, /*#__PURE__*/React.createElement(HIc, {
      name: paused ? 'play' : 'pause',
      size: 16
    }))) : null
  }), menuOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: narrow ? 18 : 36,
      top: narrow ? 56 : 66
    },
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement(ProfileMenu, {
    name: name,
    items: [{
      label: 'Einstellungen',
      icon: /*#__PURE__*/React.createElement(HIc, {
        name: "sliders",
        size: 17
      }),
      onClick: () => openSettings()
    }, ...(view === 'settings' ? [{
      label: 'Zurück zum Scout',
      icon: /*#__PURE__*/React.createElement(HIc, {
        name: "arrow-left",
        size: 17
      }),
      onClick: backToScout
    }] : [])]
  }))), /*#__PURE__*/React.createElement("main", {
    style: {
      position: 'relative',
      zIndex: 2,
      flex: 1,
      minHeight: 0,
      overflow: 'auto',
      overflowX: 'hidden',
      scrollbarWidth: 'none',
      display: view === 'scout' ? 'block' : 'none'
    }
  }, /*#__PURE__*/React.createElement(S, screenProps)), view === 'settings' && /*#__PURE__*/React.createElement(Settings, {
    d: settingsData,
    A: settingsActions,
    page: settingsPage,
    setPage: setSettingsPage,
    back: backToScout,
    session: session
  }), view === 'operator' && /*#__PURE__*/React.createElement(Operator, {
    d: opData,
    A: opActions,
    page: opPage,
    setPage: setOpPage,
    back: backToScout
  }), toast && view !== 'scout' && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      zIndex: 14,
      right: 24,
      top: 96
    }
  }, /*#__PURE__*/React.createElement(HToast, {
    onAction: backToScout,
    onDismiss: () => setToast(null)
  }, toast)), hint && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      zIndex: 8,
      left: '50%',
      bottom: 22,
      transform: 'translateX(-50%)',
      maxWidth: 'min(560px,calc(100% - 32px))'
    }
  }, /*#__PURE__*/React.createElement(HHint, null, hint)), transcriptOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      zIndex: 9,
      top: 0,
      right: 0,
      bottom: 0,
      width: 'min(420px,100%)',
      background: 'var(--rs-surface-drawer)',
      borderLeft: '1px solid var(--rs-border-card-soft)',
      display: 'flex',
      flexDirection: 'column',
      animation: 'rsFadeUp .3s ease both'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 84,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 500
    }
  }, "Mitschrift"), /*#__PURE__*/React.createElement(HBtn, {
    variant: "subtle",
    size: 40,
    label: "Mitschrift schlie\xDFen",
    onClick: () => setTranscriptOpen(false)
  }, /*#__PURE__*/React.createElement(HIc, {
    name: "close",
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: '4px 24px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, transcript.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--rs-ink-6)'
    }
  }, "Noch keine \xC4u\xDFerungen."), transcript.map((m, i) => /*#__PURE__*/React.createElement(HBubble, {
    key: i,
    who: m.who,
    compact: true,
    label: m.who === 'scout' ? 'Dein Scout' : 'Du',
    style: {
      maxWidth: '88%'
    }
  }, m.text))))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      zIndex: 10,
      left: 16,
      bottom: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 8px 6px 12px',
      borderRadius: 12,
      background: 'rgba(10,8,7,.88)',
      border: '1px solid var(--rs-border-neutral)',
      fontFamily: 'var(--font-mono)',
      fontSize: 11.5,
      color: 'var(--rs-ink-6)',
      backdropFilter: 'blur(8px)',
      flexWrap: 'wrap',
      maxWidth: 'calc(100% - 32px)'
    },
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      marginRight: 6
    }
  }, "Prototyp \xB7 Beispieldaten"), /*#__PURE__*/React.createElement("select", {
    value: view === 'scout' ? stage : view,
    onChange: e => {
      const v = e.target.value;
      if (v === 'settings') openSettings();else if (v === 'operator') {
        setView('operator');
        setMenuOpen(false);
      } else {
        setView('scout');
        go(v);
      }
    },
    "aria-label": "Kapitel",
    style: {
      height: 30,
      borderRadius: 8,
      border: 0,
      background: 'rgba(255,255,255,.06)',
      color: 'var(--rs-ink)',
      font: 'inherit',
      padding: '0 6px',
      cursor: 'pointer'
    }
  }, CHAPTERS.map(([v, l]) => /*#__PURE__*/React.createElement("option", {
    key: v,
    value: v
  }, l)), /*#__PURE__*/React.createElement("option", {
    value: "settings"
  }, "Einstellungen"), /*#__PURE__*/React.createElement("option", {
    value: "operator"
  }, "Betreiberansicht")), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setView('scout');
      go('welcome', {
        reset: true
      });
    },
    "aria-label": "Zur\xFCck zum Anfang",
    title: "Zur\xFCck zum Anfang",
    style: {
      width: 30,
      height: 30,
      borderRadius: 8,
      border: 0,
      background: 'rgba(255,255,255,.06)',
      color: 'var(--rs-ink)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(HIc, {
    name: "restart",
    size: 14
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      height: 18,
      background: 'rgba(255,255,255,.12)',
      margin: '0 2px'
    }
  }), [['Mobil', () => setMobile(m => !m), mobile], ['Einstellungen', () => openSettings()], ['Betreiberansicht', () => {
    setView('operator');
    setMenuOpen(false);
  }], ['Beispielstörung laden', loadIncident]].map(([l, fn, on]) => /*#__PURE__*/React.createElement("button", {
    key: l,
    onClick: fn,
    "aria-pressed": on,
    style: {
      height: 30,
      padding: '0 8px',
      borderRadius: 8,
      border: 0,
      background: on ? 'rgba(255,105,38,.35)' : 'rgba(255,255,255,.06)',
      color: 'var(--rs-ink)',
      font: 'inherit',
      cursor: 'pointer'
    }
  }, l))));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/roomscout-app/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/roomscout-app/Operator.jsx
try { (() => {
const DS5 = window.RoomScoutDesignSystem_e8f376;
const {
  Card: OCard,
  NavItem: ONav,
  NavGroupLabel: OGroup,
  Icon: OIc,
  Switch: OSw,
  Overline: OOvl,
  Button: OBtn,
  StatusDot: ODot,
  Badge: OBadge,
  Wordmark: OMark,
  Avatar: OAvatar,
  IconButton: OIcBtn,
  DataTable: OTable
} = DS5;
const GREEN = 'success',
  AMBER = 'warning',
  GREY = 'rgba(255,255,255,.3)';
const OPAGES = {
  overview: ['bars', 'Übersicht'],
  sources: ['database', 'Quellen'],
  tasks: ['tasks', 'Aufträge'],
  integrations: ['plug', 'Integrationen'],
  flags: ['flag', 'Feature-Flags'],
  diag: ['pulse', 'Diagnose']
};
const LOGOS = {
  convex: 'logo-convex.svg',
  firecrawl: 'logo-firecrawl.svg',
  agentmail: 'logo-agentmail.png',
  openai: 'logo-openai.svg',
  browserbase: 'logo-browserbase.png'
};
const FLAG_LABEL = {
  voice: 'Voice Scout',
  publicSearch: 'Öffentliche Quellensuche'
};
const FLAG_EFFECT = {
  voice: 'Aus: keine neuen Demo-Voice-Sessions. Laufende Gespräche werden nicht abgeschnitten, Text bleibt nutzbar.',
  publicSearch: 'An: nur vorhandene fiktive Demo-Daten. Aus: öffentliche Quellen bleiben als Präferenz gespeichert, gelten aber als „In dieser Demo nicht aktiv“.'
};
const OH1 = ({
  children
}) => /*#__PURE__*/React.createElement("h1", {
  style: {
    margin: 0,
    fontSize: 44,
    lineHeight: 1.1,
    fontWeight: 500,
    letterSpacing: '-.02em'
  }
}, children);
const OLead = ({
  children
}) => /*#__PURE__*/React.createElement("p", {
  style: {
    margin: '10px 0 0',
    fontSize: 19,
    color: 'var(--rs-ink-4)'
  }
}, children);
const SqBtn2 = ({
  children,
  onClick,
  primary,
  style
}) => /*#__PURE__*/React.createElement("button", {
  onClick: onClick,
  style: {
    height: 44,
    padding: '0 20px',
    borderRadius: 12,
    border: primary ? 0 : '1px solid var(--rs-border-control-strong)',
    background: primary ? 'var(--rs-orange)' : 'var(--rs-surface-subtle)',
    color: '#fff',
    fontFamily: 'inherit',
    fontSize: 15,
    fontWeight: primary ? 600 : 400,
    cursor: 'pointer',
    ...style
  }
}, children);
const Logo = ({
  id
}) => LOGOS[id] ? /*#__PURE__*/React.createElement("img", {
  src: '../../assets/partners/' + LOGOS[id],
  alt: "",
  style: {
    width: 24,
    height: 24,
    objectFit: 'contain',
    borderRadius: 5
  }
}) : /*#__PURE__*/React.createElement(OIc, {
  name: "card",
  size: 22
});

/* Operator source row: technical linkage, expandable. Portal switch = Demo-Zugang verbunden/abgelaufen; public-source switch = Flag „Öffentliche Quellensuche“. */
function OpSourceRow({
  x,
  flags,
  A
}) {
  const [open, setOpen] = React.useState(x.id === 'roomscout');
  const portal = x.kind === 'portal';
  const on = portal ? x.access === 'connected' : !!flags.publicSearch;
  const tone = portal ? on ? GREEN : AMBER : on ? GREEN : GREY;
  const label = portal ? on ? 'Angebunden · Demo-Zugang' : 'Zugang braucht Anmeldung' : on ? 'Öffentliche Anzeigen · Demo-Daten' : 'Nicht aktiv (Flag aus)';
  const desc = portal ? x.region + ' · Kontrolliertes Demo-Portal' : x.region + ' · Öffentliche Anzeigen';
  const icon = x.id === 'roomscout' ? /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-roomscout.png",
    alt: "",
    style: {
      width: 30,
      height: 30,
      objectFit: 'contain'
    }
  }) : /*#__PURE__*/React.createElement(OIc, {
    name: x.id === 'musiker' ? 'users' : 'music',
    size: 22
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 18,
      background: on ? 'rgba(255,255,255,.03)' : 'transparent',
      border: `1px solid ${on ? 'var(--rs-border-card-soft)' : 'transparent'}`,
      marginBottom: 8,
      transition: 'background .25s,border-color .25s'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '56px minmax(0,1fr) auto auto auto',
      alignItems: 'center',
      gap: 18,
      padding: '16px 16px 16px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      borderRadius: '50%',
      border: '1px solid var(--rs-border-control)',
      background: 'var(--rs-surface-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, icon), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 19
    }
  }, x.name), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 2,
      fontSize: 14.5,
      color: 'var(--rs-ink-4)'
    }
  }, desc)), /*#__PURE__*/React.createElement(ODot, {
    tone: tone
  }, label), /*#__PURE__*/React.createElement(OSw, {
    checked: on,
    onChange: v => portal ? A.setAccess('roomscout', v ? 'connected' : 'expired') : A.setFlags({
      ...flags,
      publicSearch: v
    }),
    label: portal ? 'Demo-Zugang' : 'Öffentliche Quellensuche'
  }), /*#__PURE__*/React.createElement(OIcBtn, {
    variant: "bare",
    size: 36,
    label: "Details",
    "aria-expanded": open,
    onClick: () => setOpen(o => !o)
  }, /*#__PURE__*/React.createElement(OIc, {
    name: "chevron-down",
    size: 18,
    style: {
      transform: open ? 'rotate(180deg)' : 'none',
      transition: 'transform .25s'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateRows: open ? '1fr' : '0fr',
      transition: 'grid-template-rows .26s cubic-bezier(.3,.7,.2,1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: 'hidden',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '0 16px',
      padding: '16px 8px 18px',
      borderTop: '1px solid var(--rs-border-divider)',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
      gap: '8px 24px',
      fontSize: 15,
      lineHeight: 1.6,
      color: 'var(--rs-ink-2)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--rs-ink-6)'
    }
  }, "Region:"), " ", x.region), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--rs-ink-6)'
    }
  }, "Anbindung:"), " ", portal ? 'Portal-Sitzung über Browserbase' : 'Öffentliche Anzeigen (Firecrawl)'), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--rs-ink-6)'
    }
  }, "Letzter Demo-Check:"), " ", portal ? x.lastAccess || 'Heute · Demo-Lauf' : '—'), /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: '1/-1',
      color: 'var(--rs-ink-4)',
      fontSize: 14.5
    }
  }, portal ? 'Der Schalter simuliert den Demo-Zugang: aus = Anmeldung abgelaufen, die Band sieht einen Hinweis in ihren Zugängen.' : 'Der Schalter entspricht dem Feature-Flag „Öffentliche Quellensuche“ und gilt für alle öffentlichen Quellen.')))));
}
function Operator({
  d,
  A,
  page,
  setPage,
  back
}) {
  const [diag, setDiag] = React.useState(false);
  const [filter, setFilter] = React.useState('all');
  const [openTask, setOpenTask] = React.useState(null);
  const [openInt, setOpenInt] = React.useState(null);
  const [flagDraft, setFlagDraft] = React.useState(null);
  const [flagsSaved, setFlagsSaved] = React.useState(false);
  const inc = !!d.incident,
    open = inc && !d.incidentResolved,
    resolved = inc && !!d.incidentResolved;
  const F = flagDraft || d.flags;
  const mk = (id, name, status, detail) => {
    const m = {
      done: ['Abgeschlossen', GREEN],
      expired: ['Anmeldung abgelaufen', AMBER],
      blocked: ['Wartet auf Zugang', GREY],
      planned: ['Geplant', GREY],
      resumed: ['Fortgesetzt (einmalig)', GREEN]
    }[status];
    return {
      id,
      name,
      status: m[0],
      tone: m[1],
      diag: status === 'expired',
      attention: status === 'expired',
      detail
    };
  };
  const tasks = [mk('t1', 'Neue Anzeigen prüfen', 'done', 'Öffentliche Anzeigen auf roomscout.dev wurden im Demo-Lauf geprüft. Ein passender Raum in Stuttgart-West wurde markiert.'), mk('t2', 'Portal-Nachrichten lesen', open ? 'expired' : inc || d.contacted ? 'done' : 'planned', open ? '' : 'Antworten im Portal werden über den verbundenen Demo-Zugang gelesen.'), mk('t3', 'Anfrage vorbereiten', open ? 'blocked' : resolved ? 'resumed' : d.contacted ? 'done' : 'planned', open ? 'Wartet, bis der Portalzugang erneut verbunden ist. Es wird keine Anfrage doppelt gesendet.' : resolved ? 'Nach der erneuerten Anmeldung einmalig fortgesetzt.' : 'Anfrage an den Anbieter im Rahmen des Handlungsspielraums der Band.')];
  const ints = [{
    id: 'convex',
    name: 'Convex AI Gateway',
    role: 'Text & Auswertung',
    status: 'Bereit',
    tone: GREEN,
    config: 'Konfiguriert',
    test: 'Erfolgreich (Demo)',
    note: 'Verarbeitet Gesprächstext und Faktenextraktion im Demo-Lauf.'
  }, {
    id: 'firecrawl',
    name: 'Firecrawl',
    role: 'Quellen beobachten',
    status: 'Konfiguriert',
    tone: GREY,
    config: 'Konfiguriert',
    test: 'Noch kein Demo-Test',
    note: 'Eine konfigurierte Integration ist kein Nachweis für einen erfolgreichen Live-Test.'
  }, {
    id: 'agentmail',
    name: 'AgentMail',
    role: 'Scout-Postfächer',
    status: 'Bereit',
    tone: GREEN,
    config: 'Konfiguriert',
    test: 'Erfolgreich (Demo)',
    note: 'Stellt die Scout-Adressen bereit, über die Portal-Benachrichtigungen ankommen.'
  }, {
    id: 'browserbase',
    name: 'Browserbase',
    role: 'Portal-Zugänge',
    status: open ? 'Prüfen' : 'Bereit',
    tone: open ? AMBER : GREEN,
    config: 'Konfiguriert',
    test: open ? '1 Portalzugang braucht eine neue Anmeldung' : 'Erfolgreich (Demo)',
    note: open ? 'Ein abgelaufener Portal-Login ist kein Ausfall von Browserbase insgesamt.' : 'Hält die Portal-Sitzungen für Lesen und Senden von Nachrichten.'
  }, {
    id: 'openai',
    name: 'OpenAI direkt',
    role: 'Voice & Embeddings',
    status: 'Bereit',
    tone: GREEN,
    config: 'Konfiguriert',
    test: 'Erfolgreich (Demo)',
    note: 'Sprachein- und -ausgabe sowie Embeddings für die Einordnung von Anzeigen.'
  }];
  const events = inc ? [['09:41', 'Portal-Benachrichtigung über neue Nachricht erhalten'], ['09:41', 'Öffnen der Portal-Nachricht fehlgeschlagen: Anmeldung abgelaufen'], ['09:42', 'Aufgabe „Portal-Nachrichten lesen“ als „Anmeldung abgelaufen“ markiert'], ['09:42', 'Aufgabe „Anfrage vorbereiten“ wartet auf Zugang'], ['09:42', 'Hinweis in den Zugängen der Band angezeigt']].concat(resolved ? [['Jetzt', 'Anmeldung erneuert (Simulation) · wartende Aufgabe einmalig fortgesetzt']] : []) : [];
  const flagEffects = ['voice', 'publicSearch'].filter(k => !!F[k] !== !!d.flags[k]).map(k => FLAG_LABEL[k] + ' → ' + (F[k] ? 'an' : 'aus') + '. ' + (k === 'voice' ? F[k] ? 'Neue Demo-Voice-Sessions sind wieder möglich.' : 'Keine neuen Demo-Voice-Sessions; Suchwissen und laufende Gespräche bleiben erhalten.' : F[k] ? 'Öffentliche Demo-Quellen werden für Nutzer aktiv. Kein Zugriff auf echte Portale.' : 'Öffentliche Quellen werden in den Nutzereinstellungen als nicht aktiv gekennzeichnet.'));
  const cols = [{
    key: 'name',
    label: 'Vorgang',
    width: '1.3fr'
  }, {
    key: 'src',
    label: 'Quelle',
    muted: true
  }, {
    key: 'status',
    label: 'Status',
    width: '1.2fr'
  }, {
    key: 'next',
    label: 'Nächster Schritt'
  }];
  const taskRows = list => list.map(t => ({
    name: t.name,
    src: 'roomscout.dev',
    status: /*#__PURE__*/React.createElement(ODot, {
      tone: t.tone,
      style: {
        fontSize: 16,
        color: 'var(--rs-ink)'
      }
    }, t.status),
    next: t.diag ? /*#__PURE__*/React.createElement(SqBtn2, {
      onClick: () => setDiag(true),
      style: {
        height: 40,
        padding: '0 18px',
        borderRadius: 10
      }
    }, "Diagnose") : /*#__PURE__*/React.createElement(OBtn, {
      variant: "link",
      size: "2xs",
      style: {
        color: 'var(--rs-ink)',
        padding: '6px 0',
        fontSize: 15,
        textDecoration: openTask === t.id ? 'underline' : 'none'
      },
      onClick: () => setOpenTask(o => o === t.id ? null : t.id)
    }, "Details ", /*#__PURE__*/React.createElement(OIc, {
      name: "chevron-right",
      size: 14
    })),
    _highlight: t.diag,
    _detail: openTask === t.id ? t.detail : null
  }));
  const TaskTable = ({
    list
  }) => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(OTable, {
    columns: cols,
    rows: taskRows(list)
  }), list.filter(t => openTask === t.id).map(t => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    style: {
      padding: '10px 14px 14px',
      fontSize: 14.5,
      color: 'var(--rs-ink-4)',
      lineHeight: 1.6,
      borderBottom: '1px solid var(--rs-border-divider-soft)',
      animation: 'rsFadeUp .2s ease both'
    }
  }, t.detail)));
  const pages = {
    overview: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(OH1, null, "Betrieb im Blick"), /*#__PURE__*/React.createElement(OLead, null, "Provider, Quellen und wartende Aufgaben."), open ? /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '14px 18px',
        borderRadius: 14,
        background: 'var(--rs-surface-amber-tint)',
        border: '1px solid rgba(224,161,58,.45)',
        animation: 'rsFadeUp .25s ease both'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        fontSize: 17
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: 'var(--rs-amber)',
        color: '#1a1208',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: 15
      }
    }, "!"), "1 Aufgabe braucht Aufmerksamkeit"), /*#__PURE__*/React.createElement(OBtn, {
      variant: "link",
      size: "2xs",
      style: {
        color: 'var(--rs-ink)',
        fontSize: 16
      },
      onClick: () => {
        setFilter('attention');
        setPage('tasks');
      }
    }, "Ansehen ", /*#__PURE__*/React.createElement(OIc, {
      name: "chevron-right",
      size: 16
    }))) : /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 18px',
        borderRadius: 14,
        background: 'rgba(255,255,255,.03)',
        border: '1px solid var(--rs-border-card-soft)',
        fontSize: 15,
        color: 'var(--rs-ink-4)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: 'var(--rs-green)'
      }
    }), "Keine Aufgabe braucht Aufmerksamkeit. Beispielst\xF6rung \xFCber die Demo-Steuerung laden."), /*#__PURE__*/React.createElement(OOvl, {
      style: {
        marginTop: 26
      }
    }, "Integrationen"), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
        gap: 12
      }
    }, ints.slice(0, 4).map(t => /*#__PURE__*/React.createElement("button", {
      key: t.id,
      onClick: () => {
        setPage('integrations');
        setOpenInt(t.id);
      },
      style: {
        textAlign: 'left',
        padding: '18px 20px',
        borderRadius: 16,
        border: '1px solid var(--rs-border-card)',
        background: 'rgba(255,255,255,.03)',
        color: 'var(--rs-ink)',
        fontFamily: 'inherit',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none'
      }
    }, /*#__PURE__*/React.createElement(Logo, {
      id: t.id
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 16.5,
        fontWeight: 500
      }
    }, t.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: 'var(--rs-ink-4)',
        marginTop: 1
      }
    }, t.role))), /*#__PURE__*/React.createElement(ODot, {
      tone: t.tone
    }, t.status)))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 14,
        paddingBottom: 18,
        borderBottom: '1px solid var(--rs-border-divider)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        fontSize: 16
      }
    }, /*#__PURE__*/React.createElement(Logo, {
      id: "openai"
    }), /*#__PURE__*/React.createElement("span", null, "OpenAI direkt"), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--rs-ink-6)'
      }
    }, "\xB7"), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--rs-ink-4)'
      }
    }, "Voice & Embeddings"), /*#__PURE__*/React.createElement(ODot, {
      tone: GREEN,
      style: {
        marginLeft: 8
      }
    }, "Bereit")), /*#__PURE__*/React.createElement(OOvl, {
      style: {
        marginTop: 24
      }
    }, "Aufgaben"), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10
      }
    }, /*#__PURE__*/React.createElement(TaskTable, {
      list: tasks
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 26,
        paddingTop: 22,
        borderTop: '1px solid var(--rs-border-divider)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0 40px'
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(OOvl, null, "Betriebsregeln"), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10,
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        padding: '10px 0',
        borderBottom: '1px solid var(--rs-border-divider-soft)',
        fontSize: 16
      }
    }, /*#__PURE__*/React.createElement("span", null, "Parallele Browser-Sessions"), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--rs-ink-4)'
      }
    }, "2")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        padding: '10px 0',
        fontSize: 16
      }
    }, /*#__PURE__*/React.createElement("span", null, "Erneute Versuche"), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--rs-ink-4)'
      }
    }, "Mit zunehmendem Abstand")), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 6,
        fontSize: 13,
        color: 'var(--rs-ink-6)'
      }
    }, "Illustrative Betriebsregeln, keine echten Worker-Pools.")), /*#__PURE__*/React.createElement("div", {
      style: {
        borderLeft: '1px solid var(--rs-border-divider)',
        paddingLeft: 30
      }
    }, /*#__PURE__*/React.createElement(OOvl, null, "Feature-Flags"), ['voice', 'publicSearch'].map(k => /*#__PURE__*/React.createElement("div", {
      key: k,
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        padding: '10px 0',
        borderBottom: '1px solid var(--rs-border-divider-soft)',
        fontSize: 16
      }
    }, /*#__PURE__*/React.createElement("div", null, FLAG_LABEL[k], k === 'publicSearch' && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        color: 'var(--rs-ink-6)',
        marginTop: 2
      }
    }, "Demo auf roomscout.dev begrenzt")), /*#__PURE__*/React.createElement(ODot, {
      tone: d.flags[k] ? GREEN : GREY
    }, d.flags[k] ? 'An' : 'Aus'))), /*#__PURE__*/React.createElement(OBtn, {
      variant: "link",
      size: "2xs",
      style: {
        marginTop: 10,
        color: 'var(--rs-ink)',
        padding: '4px 0',
        fontSize: 14.5
      },
      onClick: () => setPage('flags')
    }, "Flags bearbeiten")))),
    sources: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(OH1, null, "Quellen"), /*#__PURE__*/React.createElement(OLead, null, "Technische Anbindung der Demo-Quellen, unabh\xE4ngig von Nutzerpr\xE4ferenzen."), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 26,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline'
      }
    }, /*#__PURE__*/React.createElement(OOvl, null, "Angebundene Quellen"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: 'var(--rs-ink-6)'
      }
    }, "Demo-Lauf")), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12
      }
    }, d.sources.map(x => /*#__PURE__*/React.createElement(OpSourceRow, {
      key: x.id,
      x: x,
      flags: d.flags,
      A: A
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 16,
        fontSize: 14.5,
        color: 'var(--rs-ink-6)',
        lineHeight: 1.6
      }
    }, "Der Demo-Lauf ist auf roomscout.dev begrenzt. Pers\xF6nliche Quellenpr\xE4ferenzen der Nutzer (z. B. \u201EBandnet f\xFCr meine Suche ausschlie\xDFen\u201C) ver\xE4ndern diesen Status nicht.")),
    tasks: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(OH1, null, "Auftr\xE4ge"), /*#__PURE__*/React.createElement(OLead, null, "Vorg\xE4nge des laufenden Demo-Auftrags."), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 22,
        display: 'flex',
        gap: 6
      }
    }, [['all', 'Alle'], ['attention', 'Braucht Aufmerksamkeit']].map(([v, l]) => /*#__PURE__*/React.createElement("button", {
      key: v,
      "aria-pressed": filter === v,
      onClick: () => setFilter(v),
      style: {
        height: 38,
        padding: '0 16px',
        borderRadius: 999,
        border: '1px solid rgba(255,220,190,.2)',
        background: filter === v ? 'rgba(255,105,38,.3)' : 'var(--rs-surface-subtle)',
        color: 'var(--rs-ink)',
        fontFamily: 'inherit',
        fontSize: 14.5,
        cursor: 'pointer'
      }
    }, l))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 16
      }
    }, /*#__PURE__*/React.createElement(TaskTable, {
      list: filter === 'attention' ? tasks.filter(t => t.attention) : tasks
    }), filter === 'attention' && !tasks.some(t => t.attention) && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '18px 14px',
        fontSize: 15,
        color: 'var(--rs-ink-6)'
      }
    }, "Keine Aufgabe braucht Aufmerksamkeit."))),
    integrations: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(OH1, null, "Integrationen"), /*#__PURE__*/React.createElement(OLead, null, "Rolle und lokaler Demo-Status je Provider. Keine Schl\xFCssel, keine Secrets."), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 26
      }
    }, ints.map(i => /*#__PURE__*/React.createElement("div", {
      key: i.id,
      style: {
        borderBottom: '1px solid var(--rs-border-divider)'
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setOpenInt(o => o === i.id ? null : i.id),
      "aria-expanded": openInt === i.id,
      style: {
        width: '100%',
        display: 'grid',
        gridTemplateColumns: '1.2fr 1.3fr 1fr auto',
        gap: 14,
        alignItems: 'center',
        padding: '16px 10px',
        border: 0,
        background: 'none',
        color: 'var(--rs-ink)',
        fontFamily: 'inherit',
        fontSize: 16,
        textAlign: 'left',
        cursor: 'pointer',
        borderRadius: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontWeight: 500
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 26,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none'
      }
    }, /*#__PURE__*/React.createElement(Logo, {
      id: i.id
    })), i.name), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--rs-ink-4)'
      }
    }, i.role), /*#__PURE__*/React.createElement(ODot, {
      tone: i.tone,
      style: {
        fontSize: 16,
        color: 'var(--rs-ink)'
      }
    }, i.status), /*#__PURE__*/React.createElement(OIc, {
      name: "chevron-down",
      size: 16,
      style: {
        transform: openInt === i.id ? 'rotate(180deg)' : 'none',
        transition: 'transform .2s'
      }
    })), openInt === i.id && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '4px 10px 18px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
        gap: '10px 24px',
        fontSize: 14.5,
        lineHeight: 1.6,
        animation: 'rsFadeUp .2s ease both'
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--rs-ink-6)'
      }
    }, "Konfiguration:"), " ", i.config), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--rs-ink-6)'
      }
    }, "Letzter Demo-Test:"), " ", i.test), /*#__PURE__*/React.createElement("div", {
      style: {
        gridColumn: '1/-1',
        color: 'var(--rs-ink-4)'
      }
    }, i.note)))))),
    flags: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(OH1, null, "Feature-Flags"), /*#__PURE__*/React.createElement(OLead, null, "Lokale Demo-\xC4nderungen, keine Deployments."), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 26
      }
    }, ['voice', 'publicSearch'].map(k => /*#__PURE__*/React.createElement("div", {
      key: k,
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 20,
        padding: '18px 0',
        borderBottom: '1px solid var(--rs-border-divider)'
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 17
      }
    }, FLAG_LABEL[k]), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 3,
        fontSize: 14.5,
        color: 'var(--rs-ink-4)'
      }
    }, FLAG_EFFECT[k])), /*#__PURE__*/React.createElement(OSw, {
      checked: !!F[k],
      onChange: v => {
        setFlagDraft({
          ...F,
          [k]: v
        });
        setFlagsSaved(false);
      },
      label: FLAG_LABEL[k]
    })))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 14,
        fontSize: 14.5,
        color: 'var(--rs-ink-6)'
      }
    }, "Demo auf roomscout.dev begrenzt. Es startet kein echter Crawl."), flagDraft && flagEffects.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 22,
        padding: '18px 22px',
        borderRadius: 14,
        background: 'rgba(255,255,255,.03)',
        border: '1px solid var(--rs-border-card)',
        animation: 'rsFadeUp .2s ease both'
      }
    }, /*#__PURE__*/React.createElement(OOvl, null, "Wirkung vor dem Speichern"), /*#__PURE__*/React.createElement("ul", {
      style: {
        margin: '10px 0 0',
        paddingLeft: 18,
        fontSize: 15,
        lineHeight: 1.7,
        color: 'var(--rs-ink-2)'
      }
    }, flagEffects.map(e => /*#__PURE__*/React.createElement("li", {
      key: e
    }, e))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 16,
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(SqBtn2, {
      onClick: () => setFlagDraft(null)
    }, "Abbrechen"), /*#__PURE__*/React.createElement(SqBtn2, {
      primary: true,
      onClick: () => {
        A.setFlags({
          ...F
        });
        setFlagDraft(null);
        setFlagsSaved(true);
        setTimeout(() => setFlagsSaved(false), 2600);
      }
    }, "Lokal speichern"))), flagsSaved && /*#__PURE__*/React.createElement("div", {
      role: "status",
      style: {
        marginTop: 16,
        fontSize: 14.5,
        color: 'var(--rs-ink-4)',
        animation: 'rsFadeUp .2s ease both'
      }
    }, "Flags lokal gespeichert.")),
    diag: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(OH1, null, "Diagnose"), /*#__PURE__*/React.createElement(OLead, null, "Verst\xE4ndliche Ereignisse aus den lokalen Demo-Daten."), !inc ? /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 26,
        padding: '22px 24px',
        borderRadius: 16,
        background: 'rgba(255,255,255,.03)',
        border: '1px solid var(--rs-border-card-soft)',
        fontSize: 16,
        color: 'var(--rs-ink-2)'
      }
    }, "Keine offenen St\xF6rungen. \xDCber die Demo-Steuerung l\xE4sst sich eine Beispielst\xF6rung laden.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 26
      }
    }, events.map(([w, t], i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'grid',
        gridTemplateColumns: '110px 1fr',
        gap: 16,
        padding: '12px 0',
        borderBottom: '1px solid var(--rs-border-divider-soft)',
        fontSize: 15.5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--rs-ink-6)'
      }
    }, w), /*#__PURE__*/React.createElement("span", null, t)))), open && /*#__PURE__*/React.createElement(SqBtn2, {
      onClick: () => setDiag(true),
      style: {
        marginTop: 20
      }
    }, "Diagnose-Sheet \xF6ffnen")))
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 2,
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      animation: 'rsFadeUp .35s ease both'
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      height: 84,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 36px',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(OMark, null), /*#__PURE__*/React.createElement(OBadge, {
    variant: "outline"
  }, "Intern")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 42,
      padding: '0 18px',
      borderRadius: 999,
      border: '1px solid var(--rs-border-card-strong)',
      background: 'var(--rs-surface-subtle)',
      display: 'flex',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(ODot, {
    tone: GREEN,
    style: {
      gap: 10,
      color: 'var(--rs-ink)'
    }
  }, "Entwicklung")), /*#__PURE__*/React.createElement(OAvatar, {
    initials: "OP"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      padding: '4px 36px 0',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement(OCard, {
    tone: "panel",
    size: "panel",
    padding: 0,
    style: {
      flex: 1,
      minHeight: 0,
      maxWidth: 1380,
      width: '100%',
      margin: '0 auto',
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: '296px minmax(0,1fr)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("nav", {
    style: {
      padding: '36px 26px 30px',
      borderRight: '1px solid var(--rs-border-divider-soft)',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      overflow: 'auto',
      scrollbarWidth: 'none'
    }
  }, /*#__PURE__*/React.createElement(OBtn, {
    variant: "ghost",
    icon: /*#__PURE__*/React.createElement(OIc, {
      name: "arrow-left",
      size: 20
    }),
    style: {
      color: 'var(--rs-ink)',
      fontSize: 16,
      padding: '8px 10px',
      justifyContent: 'flex-start',
      gap: 12
    },
    onClick: back
  }, "Zur App"), /*#__PURE__*/React.createElement(OGroup, {
    style: {
      margin: '34px 10px 10px'
    }
  }, "Betrieb"), Object.entries(OPAGES).map(([id, [ic, l]]) => /*#__PURE__*/React.createElement(ONav, {
    key: id,
    current: page === id,
    icon: /*#__PURE__*/React.createElement(OIc, {
      name: ic,
      size: 20
    }),
    onClick: () => setPage(id),
    style: {
      marginBottom: 4,
      ...(page === id ? {
        background: 'rgba(120,58,22,.45)',
        borderColor: 'rgba(255,140,90,.35)'
      } : {})
    }
  }, l)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--rs-border-divider)',
      margin: '24px 0 20px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 10px',
      fontSize: 15,
      color: 'var(--rs-ink-4)'
    }
  }, "Nur f\xFCr Betreiber")), /*#__PURE__*/React.createElement("section", {
    key: page,
    style: {
      minHeight: 0,
      overflow: 'auto',
      scrollbarWidth: 'thin',
      padding: '42px 46px 40px',
      animation: 'rsFadeUp .2s ease-out both'
    }
  }, pages[page]), diag && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: () => setDiag(false),
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 20,
      background: 'rgba(6,4,3,.55)',
      animation: 'rsFadeUp .2s ease both'
    }
  }), /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    style: {
      position: 'absolute',
      zIndex: 21,
      top: 0,
      right: 0,
      bottom: 0,
      width: 'min(500px,100%)',
      background: 'rgba(18,14,11,.98)',
      borderLeft: '1px solid var(--rs-border-panel)',
      padding: 34,
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column',
      animation: 'rsFadeUp .25s ease both'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 26,
      fontWeight: 500
    }
  }, "Diagnose"), /*#__PURE__*/React.createElement(OIcBtn, {
    variant: "subtle",
    size: 40,
    label: "Schlie\xDFen",
    onClick: () => setDiag(false)
  }, /*#__PURE__*/React.createElement(OIc, {
    name: "close",
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      fontSize: 16,
      lineHeight: 1.5
    }
  }, [['Vorgang', 'Portal-Nachrichten lesen'], ['Portal', 'roomscout.dev · Profil Herzbuben'], ['Zustand', /*#__PURE__*/React.createElement(ODot, {
    tone: open ? AMBER : GREEN,
    style: {
      fontSize: 16,
      color: 'var(--rs-ink)'
    }
  }, open ? 'Anmeldung abgelaufen' : 'Verbunden (erneuert)')]].map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 16,
      paddingBottom: 12,
      borderBottom: '1px solid var(--rs-border-divider)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--rs-ink-6)'
    }
  }, k), /*#__PURE__*/React.createElement("span", null, v))), [['Ursache', 'Die gespeicherte Anmeldung ist abgelaufen.'], ['Auswirkung', 'Private Portalnachrichten können momentan nicht gelesen werden. Die Suche nach Anzeigen läuft weiter.'], ['Nächster Schritt', 'Portalzugang erneut verbinden. Die Band sieht dazu einen Hinweis in ihren Zugängen.']].map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--rs-ink-6)'
    }
  }, k), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4
    }
  }, v))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--rs-ink-6)'
    }
  }, "Ereignisfolge"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, events.map(([w, t], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'grid',
      gridTemplateColumns: '100px 1fr',
      gap: 12,
      padding: '6px 0',
      borderBottom: '1px solid rgba(255,220,190,.06)',
      fontSize: 14.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--rs-ink-6)'
    }
  }, w), /*#__PURE__*/React.createElement("span", null, t)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), open && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      padding: '16px 18px',
      borderRadius: 14,
      border: '1px dashed rgba(255,200,160,.35)',
      background: 'rgba(255,255,255,.03)'
    }
  }, /*#__PURE__*/React.createElement(OOvl, {
    tone: "accent"
  }, "Simulation"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 14.5,
      color: 'var(--rs-ink-4)',
      lineHeight: 1.55
    }
  }, "Setzt den Beispielzugang lokal auf \u201EVerbunden\u201C und gibt die wartende Demo-Aufgabe einmalig frei. Bereits abgeschlossene Anfragen werden nicht erneut ausgel\xF6st."), /*#__PURE__*/React.createElement(SqBtn2, {
    primary: true,
    onClick: A.renewLogin,
    style: {
      marginTop: 14,
      width: '100%',
      height: 46
    }
  }, "Anmeldung als erneuert simulieren")), resolved && /*#__PURE__*/React.createElement("div", {
    role: "status",
    style: {
      marginTop: 20,
      fontSize: 14.5,
      color: 'var(--rs-ink-4)'
    }
  }, "Zugang erneuert. Die wartende Aufgabe wurde einmalig fortgesetzt.")))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      fontSize: 13,
      color: 'var(--rs-ink-6)',
      padding: '14px 0 12px'
    }
  }, "Interner Status \xB7 Darstellung mit Beispieldaten")));
}
Object.assign(window, {
  Operator
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/roomscout-app/Operator.jsx", error: String((e && e.message) || e) }); }

// ui_kits/roomscout-app/ScreensA.jsx
try { (() => {
const DS = window.RoomScoutDesignSystem_e8f376;
const {
  ScoutBlob,
  Button,
  Icon,
  Capsule,
  FactList,
  VoiceControl,
  Composer,
  SummaryPill,
  Card,
  Overline,
  ChatBubble,
  StatusDot
} = DS;
const SCRIPT = [{
  who: 'scout',
  text: 'Hey Herzbuben! Erzählt mir kurz: Wo sucht ihr und was ist euch wichtig?'
}, {
  who: 'user',
  text: 'Wir sind zu viert und suchen einen geteilten Raum in Stuttgart. Bis 400 Euro im Monat.',
  facts: [{
    id: 'ort',
    label: 'Stuttgart'
  }, {
    id: 'budget',
    label: 'Bis 400 € / Monat'
  }, {
    id: 'band',
    label: 'Geteilter Raum · 4 Personen'
  }]
}, {
  who: 'scout',
  text: 'Welche Tage passen euch zum Proben?'
}, {
  who: 'user',
  text: 'Donnerstags ab 19 Uhr wäre gut.',
  facts: [{
    id: 'zeit',
    label: 'Donnerstags ab 19 Uhr'
  }]
}, {
  who: 'scout',
  text: 'Gibt es etwas, das im Raum vorhanden sein oder dort bleiben muss?'
}, {
  who: 'user',
  text: 'Unser eigenes Schlagzeug muss dort stehen bleiben können. Verstärker bringen wir mit.',
  facts: [{
    id: 'equip',
    label: 'Schlagzeug darf im Raum bleiben'
  }]
}, {
  who: 'user',
  text: 'Und beim Budget lieber maximal 350 Euro.',
  facts: [{
    id: 'budget',
    label: 'Bis 350 € / Monat'
  }]
}, {
  who: 'scout',
  text: 'Alles klar, maximal 350 Euro. So würde ich für euch suchen. Soll ich loslegen?',
  end: true
}];
function Welcome({
  go,
  name,
  narrow,
  voiceOff,
  showHint
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '24px 24px 40px'
    }
  }, /*#__PURE__*/React.createElement(ScoutBlob, {
    size: narrow ? 128 : 168,
    style: {
      marginBottom: narrow ? 36 : 56
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 19,
      color: 'var(--rs-ink-2)'
    }
  }, "Hey ", name, "."), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: '14px 0 0',
      fontSize: narrow ? 38 : 'clamp(38px,6vw,64px)',
      lineHeight: 1.08,
      fontWeight: 300,
      letterSpacing: '-.02em',
      maxWidth: 640,
      textWrap: 'balance'
    }
  }, "Finden wir euren Proberaum."), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "mic",
      size: 20
    }),
    style: {
      marginTop: 48
    },
    onClick: () => {
      if (voiceOff) {
        go('discovery', {
          mode: 'text'
        });
        showHint('Voice Scout ist in dieser Demo deaktiviert. Das Gespräch läuft im Textmodus.');
      } else go('discovery', {
        mode: 'voice'
      });
    }
  }, "Mit Scout sprechen"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "keyboard",
      size: 20
    }),
    style: {
      marginTop: 22,
      fontSize: 16
    },
    onClick: () => go('discovery', {
      mode: 'text'
    })
  }, "Lieber schreiben"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'min(12vh,110px)',
      fontSize: 15,
      color: 'var(--rs-ink-5)'
    }
  }, "Du erz\xE4hlst. Dein Scout k\xFCmmert sich."));
}
function Discovery({
  go,
  mode,
  setMode,
  facts,
  setFacts,
  transcript,
  setTranscript,
  toggleTranscript,
  narrow,
  showHint
}) {
  const [step, setStep] = React.useState(0);
  const [capsule, setCapsule] = React.useState(null);
  const [micOn, setMicOn] = React.useState(true);
  const [draft, setDraft] = React.useState('');
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const ctrl = narrow ? 60 : 76;
  const line = SCRIPT[Math.min(step, SCRIPT.length - 1)];
  const timers = React.useRef([]);
  const after = (ms, fn) => timers.current.push(setTimeout(fn, ms));
  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const applyFacts = (fs, done) => {
    fs.forEach((f, i) => {
      after(300 + i * 1100, () => setCapsule(f.label));
      after(900 + i * 1100, () => {
        setCapsule(null);
        setFacts(prev => prev.some(p => p.id === f.id) ? prev.map(p => p.id === f.id ? {
          ...p,
          label: f.label,
          changed: true
        } : p) : prev.concat([{
          ...f
        }]));
        after(1200, () => setFacts(prev => prev.map(p => ({
          ...p,
          changed: false
        }))));
      });
    });
    after(600 + fs.length * 1100, done);
  };
  const advance = React.useCallback(() => {
    const cur = SCRIPT[step];
    if (!cur) return;
    setTranscript(t => t.concat([cur]));
    if (cur.end) {
      after(1400, () => go('brief'));
      return;
    }
    if (cur.facts) applyFacts(cur.facts, () => setStep(s => s + 1));else after(mode === 'voice' ? 2600 : 600, () => setStep(s => s + 1));
  }, [step, mode]);
  React.useEffect(() => {
    if (mode === 'voice' || line.who === 'scout') advance();
  }, [step, mode]);
  const isScout = line.who === 'scout';
  const suggestion = mode === 'text' && !isScout ? line.text : null;
  const send = t => {
    setDraft('');
    advance();
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: `16px 24px ${narrow && facts.length ? 96 : 32}px`,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(ScoutBlob, {
    size: narrow ? mode === 'voice' ? 120 : 88 : mode === 'voice' ? 150 : 96,
    state: isScout ? 'speaking' : 'listening',
    style: {
      marginBottom: 28,
      transition: 'width .6s,height .6s'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: 15,
      color: 'var(--rs-ink-4)',
      minHeight: 22
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 500,
      color: 'var(--rs-ink-2)'
    }
  }, isScout ? 'Dein Scout' : 'Du'), isScout ? null : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--rs-ink-8)'
    }
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, "Ich h\xF6re zu"))), /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: 170,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("p", {
    key: step,
    style: {
      margin: '12px 0 0',
      fontSize: narrow ? mode === 'voice' ? 28 : 24 : mode === 'voice' ? 'clamp(28px,3.6vw,46px)' : 'clamp(24px,3vw,36px)',
      lineHeight: 1.16,
      fontWeight: 300,
      letterSpacing: '-.015em',
      maxWidth: !narrow && facts.length ? 'min(760px, calc(100vw - 660px))' : 760,
      textWrap: 'balance',
      color: 'var(--rs-ink-bright)',
      animation: 'rsFadeUp .5s ease both'
    }
  }, mode === 'text' && !isScout ? '' : line.text)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 48,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 6
    }
  }, capsule && /*#__PURE__*/React.createElement(Capsule, {
    key: capsule
  }, capsule)), mode === 'voice' ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 36,
      display: 'flex',
      gap: narrow ? 20 : 34,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(VoiceControl, {
    tone: "accent",
    size: ctrl,
    active: micOn,
    label: micOn ? 'Mikro an' : 'Mikro aus',
    onClick: () => setMicOn(m => !m)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: micOn ? 'mic' : 'mic-off',
    size: 26
  })), /*#__PURE__*/React.createElement(VoiceControl, {
    size: ctrl,
    label: "Mitschrift",
    onClick: toggleTranscript
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "transcript",
    size: 24
  })), /*#__PURE__*/React.createElement(VoiceControl, {
    size: ctrl,
    tone: "danger",
    label: "Gespr\xE4ch beenden",
    onClick: () => go('welcome')
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "close",
    size: 24
  }))), /*#__PURE__*/React.createElement(Button, {
    variant: "link",
    size: "2xs",
    style: {
      marginTop: 26,
      color: 'var(--rs-ink-6)',
      textDecoration: 'none',
      fontSize: 14
    },
    onClick: () => setMode('text')
  }, "Zum Schreiben wechseln")) : /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22,
      width: 'min(640px,100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 12
    }
  }, suggestion && /*#__PURE__*/React.createElement(Button, {
    variant: "tint",
    size: "2xs",
    style: {
      fontWeight: 400,
      height: 'auto',
      padding: '8px 14px',
      whiteSpace: 'normal',
      textAlign: 'left'
    },
    onClick: () => send(suggestion)
  }, suggestion), /*#__PURE__*/React.createElement(Composer, {
    value: draft,
    onChange: setDraft,
    onSubmit: () => {
      const t = draft.trim();
      if (!t) return;
      if (isScout) {
        showHint('Der Scout ist noch nicht fertig. Gleich kannst du antworten.');
        return;
      }
      const ref = line.text.toLowerCase();
      const hits = t.toLowerCase().split(/\s+/).filter(w => w.length > 3 && ref.includes(w)).length;
      if (hits >= 2) send(t);else showHint('Prototyp: Freitext wird hier nicht interpretiert. Nutze den vorbereiteten Antwortvorschlag oder formuliere ihn ähnlich.');
    },
    onVoice: () => setMode('voice'),
    placeholder: isScout ? 'Dein Scout spricht …' : 'Antwort an deinen Scout …'
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "2xs",
    style: {
      color: 'var(--rs-ink-6)',
      fontSize: 14
    },
    onClick: toggleTranscript
  }, "Mitschrift"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "2xs",
    style: {
      color: 'var(--rs-ink-6)',
      fontSize: 14
    },
    onClick: () => go('welcome')
  }, "Gespr\xE4ch beenden"))), facts.length > 0 && !narrow && /*#__PURE__*/React.createElement(FactList, {
    facts: facts,
    style: {
      position: 'absolute',
      right: 40,
      top: '50%',
      transform: 'translateY(-50%)',
      animation: 'rsFadeUp .5s ease both'
    }
  }), facts.length > 0 && narrow && /*#__PURE__*/React.createElement(BottomSheet, {
    title: facts.length + (facts.length === 1 ? ' Wunsch gemerkt' : ' Wünsche gemerkt'),
    open: sheetOpen,
    onToggle: () => setSheetOpen(o => !o)
  }, sheetOpen && /*#__PURE__*/React.createElement(FactList, {
    facts: facts,
    variant: "compact",
    style: {
      width: '100%',
      padding: '6px 0 0',
      background: 'none',
      border: 0
    },
    title: ""
  })));
}

/** Mobile bottom sheet: compact pill ("5 Wünsche gemerkt") or full-width card (Suchauftrag review). */
function BottomSheet({
  title,
  open,
  onToggle,
  card,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      zIndex: 6,
      left: card ? 0 : 12,
      right: card ? 0 : 12,
      bottom: card ? 0 : 12,
      borderRadius: card ? '26px 26px 0 0' : 20,
      background: 'rgba(18,14,12,.92)',
      border: '1px solid var(--rs-border-panel)',
      backdropFilter: 'var(--blur-sheet)',
      padding: card ? '22px 22px 26px' : '8px 14px 8px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      maxHeight: '78%',
      overflow: 'auto',
      boxShadow: '0 -20px 60px rgba(0,0,0,.4)',
      textAlign: 'left',
      transition: 'left .6s cubic-bezier(.22,.8,.2,1),right .6s,bottom .6s,border-radius .6s,padding .6s'
    }
  }, card ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      padding: '6px 4px'
    }
  }, title) : /*#__PURE__*/React.createElement("button", {
    onClick: onToggle,
    "aria-expanded": open,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      border: 0,
      background: 'none',
      color: 'var(--rs-ink)',
      fontFamily: 'inherit',
      fontSize: 15,
      fontWeight: 500,
      padding: '6px 4px',
      cursor: 'pointer',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("span", null, title), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-up",
    size: 16,
    style: {
      transform: open ? 'rotate(180deg)' : 'none',
      transition: 'transform .3s'
    }
  })), children);
}
function Brief({
  go,
  facts,
  setFacts,
  narrow
}) {
  const [editing, setEditing] = React.useState(false);
  const [drafts, setDrafts] = React.useState({});
  const save = () => {
    setFacts(f => f.map(x => drafts[x.id] !== undefined && drafts[x.id].trim() ? {
      ...x,
      label: drafts[x.id].trim()
    } : x));
    setEditing(false);
    setDrafts({});
  };
  const actions = editing ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      display: 'flex',
      gap: 10,
      justifyContent: 'center',
      animation: 'rsFadeUp .3s ease both'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: save
  }, "\xDCbernehmen"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    onClick: () => {
      setEditing(false);
      setDrafts({});
    }
  }, "Abbrechen")) : /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 14,
      animation: 'rsFadeUp .45s ease both'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "md",
    block: true,
    onClick: () => go('scouting')
  }, "Scout losschicken"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14.5,
      lineHeight: 1.55,
      color: 'var(--rs-ink-4)',
      textAlign: 'center'
    }
  }, "Ich suche und frage selbstst\xE4ndig an.", /*#__PURE__*/React.createElement("br", null), "Eine verbindliche Zusage gibst nur du."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "link",
    size: "2xs",
    style: {
      color: 'var(--rs-ink-2)',
      fontSize: 15
    },
    onClick: () => setEditing(true)
  }, "Noch etwas \xE4ndern"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "2xs",
    style: {
      color: 'var(--rs-ink-6)',
      fontSize: 15
    },
    onClick: () => go('discovery')
  }, "Zur\xFCck zum Gespr\xE4ch")));
  if (narrow) return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      padding: '30px 24px 40px',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(ScoutBlob, {
    size: 96
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: '22px 0 0',
      fontSize: 34,
      lineHeight: 1.1,
      fontWeight: 300,
      letterSpacing: '-.02em'
    }
  }, "So suche ich f\xFCr euch."), /*#__PURE__*/React.createElement(BottomSheet, {
    card: true,
    title: "Euer Suchauftrag"
  }, /*#__PURE__*/React.createElement(FactList, {
    facts: facts,
    variant: "compact",
    title: "",
    editing: editing,
    drafts: drafts,
    onDraftChange: (id, v) => setDrafts(d => ({
      ...d,
      [id]: v
    })),
    style: {
      width: '100%',
      padding: 0,
      background: 'none',
      border: 0
    }
  }), actions));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      padding: '30px 24px 40px',
      animation: 'rsFadeUp .7s ease both'
    }
  }, /*#__PURE__*/React.createElement(ScoutBlob, {
    size: 96
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: '22px 0 26px',
      fontSize: 'clamp(34px,4.6vw,52px)',
      lineHeight: 1.1,
      fontWeight: 300,
      letterSpacing: '-.02em'
    }
  }, "So suche ich f\xFCr euch."), /*#__PURE__*/React.createElement(FactList, {
    variant: "card",
    facts: facts,
    onEdit: () => setEditing(true),
    editing: editing,
    drafts: drafts,
    onDraftChange: (id, v) => setDrafts(d => ({
      ...d,
      [id]: v
    }))
  }, actions));
}
Object.assign(window, {
  Welcome,
  Discovery,
  Brief,
  BottomSheet,
  SCRIPT
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/roomscout-app/ScreensA.jsx", error: String((e && e.message) || e) }); }

// ui_kits/roomscout-app/ScreensB.jsx
try { (() => {
const DS2 = window.RoomScoutDesignSystem_e8f376;
const {
  ScoutBlob: Blob2,
  Button: Btn,
  Icon: Ic,
  FactList: Facts,
  Composer: Comp,
  SummaryPill: Pill,
  Card: Crd,
  Overline: Ovl,
  ChatBubble: Bubble,
  Notice: Ntc,
  StatusDot: Dot2
} = DS2;
const STATUS = ['Ich suche nach passenden Räumen in Stuttgart.', 'Ein Raum in Stuttgart-West könnte passen. Ich prüfe die Details.', 'Ich habe angefragt, ob euer Schlagzeug im Raum bleiben kann und Donnerstag frei ist.', 'Jetzt warte ich auf eine Antwort.'];
const START_LINE = 'Alles klar. Ich suche passende Räume und kläre die Details. Ich melde mich, wenn ich euch brauche.';
const FOLLOW_STATUS = 'Ich bestätige, dass Mittwoch für euch möglich ist, und lasse mir das Angebot geben.';
const ALT_STATUS = 'Ich frage nach einer Alternative zu Mittwoch und suche weiter.';
const OFFER_TALK = 'Das Angebot liegt bei 280 Euro inklusive Nebenkosten. Ihr könnt mittwochs von 19 bis 22 Uhr proben, und euer Schlagzeug darf bleiben. Soll ich euch die übrigen Konditionen erklären?';
const QA_A = 'Ich sage dem Anbieter verbindlich zu und schicke euch die Bestätigung mit allen Bedingungen. Ihr könnt ab dem 1. Oktober proben. In dieser Demo wird nichts versendet.';
const ACT = {
  start: {
    text: 'Suchauftrag gestartet'
  },
  found: {
    text: 'Raum in Stuttgart-West gefunden',
    meta: 'roomscout.dev · Demo-Portal'
  },
  contacted: {
    text: 'Anbieter über das Portal kontaktiert'
  },
  waiting: {
    text: 'Warte auf Antwort'
  },
  notif: {
    text: 'Benachrichtigung aus dem Portal erhalten'
  },
  read: {
    text: 'Neue Nachricht im Portal gelesen'
  },
  confirmed: {
    text: 'Mittwoch bestätigt, Angebot angefragt'
  },
  alt: {
    text: 'Alternative zu Mittwoch angefragt'
  },
  offer: {
    text: 'Angebot eingegangen'
  },
  declined: {
    text: 'Anbieter hat abgesagt: Donnerstag nicht möglich'
  },
  noMatch: {
    text: 'Kein weiterer passender Raum in Stuttgart gefunden'
  },
  found2: {
    text: 'Drei Räume zum Vergleich zusammengestellt',
    meta: 'roomscout.dev · Demo-Portal'
  }
};

/* Autopilot: status line + activity. The sequence is driven by `ap` (kind) from App state so it survives settings/operator overlays. */
function Autopilot({
  go,
  facts,
  paused,
  narrow,
  ap,
  setAp,
  status,
  setStatus,
  activity,
  addActivity,
  rules,
  sources,
  flags,
  pending,
  setPending,
  waitingFor,
  setWaitingFor,
  openSettings,
  showHint,
  name
}) {
  const [briefOpen, setBriefOpen] = React.useState(false);
  const [actOpen, setActOpen] = React.useState(false);
  const [note, setNote] = React.useState('');
  const T = React.useRef([]);
  const after = (ms, fn) => T.current.push(setTimeout(fn, ms));
  const usable = sources.filter(s => s.enabled && (s.kind === 'portal' || flags.publicSearch));
  const room = sources.find(s => s.id === 'roomscout');
  const budget = (facts.find(f => f.id === 'budget') || {}).label || 'bis 350 €';
  const attemptContact = () => {
    if (!usable.length || !room.enabled) {
      setStatus('Aktuell ist keine nutzbare Quelle für Anfragen ausgewählt. Wähle eine Quelle in den Einstellungen.');
      setWaitingFor('source');
      return;
    }
    if (room.access !== 'connected') {
      setStatus('Mein Zugang zu roomscout.dev braucht eine neue Anmeldung, bevor ich anfragen kann.');
      setWaitingFor('access');
      return;
    }
    if (rules.mode === 'review' || !rules.contact) {
      const text = 'Hallo, wir sind ' + name + ', eine vierköpfige Band aus Stuttgart. Wir suchen einen geteilten Proberaum, ' + budget.replace('Bis', 'bis') + ', donnerstags ab 19 Uhr. Wichtig wäre, dass unser Schlagzeug im Raum bleiben kann. Ist der Raum in Stuttgart-West noch verfügbar? Viele Grüße, ' + name + ' (über RoomScout)';
      setPending({
        to: 'Anbieter · Raum in Stuttgart-West · roomscout.dev',
        text,
        reason: !rules.contact ? 'contact' : 'review'
      });
      setStatus('Ich habe eine Anfrage vorbereitet. Sie geht erst raus, wenn du sie freigibst.');
      setWaitingFor('release');
      return;
    }
    setAp({
      kind: 'contact'
    });
  };
  React.useEffect(() => {
    T.current.forEach(clearTimeout);
    T.current = [];
    if (paused || waitingFor || pending) return;
    const k = ap.kind;
    if (k === 'start') {
      setStatus(START_LINE);
      after(3800, () => setStatus(STATUS[0]));
      after(7800, () => {
        setStatus(STATUS[1]);
        addActivity(ACT.found);
      });
      after(11800, attemptContact);
    } else if (k === 'retry') {
      attemptContact();
    } else if (k === 'contact') {
      setStatus(STATUS[2]);
      addActivity(ACT.contacted);
      after(3000, () => {
        setStatus(STATUS[3]);
        addActivity(ACT.waiting);
      });
      after(10000, () => {
        addActivity(ACT.notif);
        addActivity(ACT.read);
        go('clarification');
      });
    } else if (k === 'follow') {
      setStatus(ap.line || FOLLOW_STATUS);
      after(5000, () => {
        addActivity(ACT.offer);
        go('offer');
      });
    } else if (k === 'alt') {
      setStatus(ALT_STATUS);
      after(6000, () => {
        addActivity(ACT.declined);
        addActivity(ACT.noMatch);
        go('dead_end');
      });
    } else if (k === 'compromise') {
      setStatus(ap.line);
      if (ap.target === 'zeit') {
        after(3500, () => setStatus(FOLLOW_STATUS));
        after(8500, () => {
          addActivity(ACT.offer);
          go('offer');
        });
      } else {
        after(3500, () => setStatus('Ich suche erneut mit den neuen Kriterien.'));
        after(7000, () => {
          addActivity(ACT.found2);
          go('candidates');
        });
      }
    } else if (k === 'keep') {
      setStatus(ap.line);
    }
    return () => T.current.forEach(clearTimeout);
  }, [ap, paused, waitingFor, pending, rules.mode, rules.contact, room.access, room.enabled, flags.publicSearch]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '16px 24px 32px',
      animation: 'rsFadeUp .6s ease both'
    }
  }, /*#__PURE__*/React.createElement(Blob2, {
    size: narrow ? 112 : 160,
    state: paused ? 'still' : 'idle',
    style: {
      marginBottom: narrow ? 30 : 48
    }
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: narrow ? 34 : 'clamp(36px,5vw,58px)',
      lineHeight: 1.08,
      fontWeight: 300,
      letterSpacing: '-.02em'
    }
  }, "Ich k\xFCmmere mich darum."), /*#__PURE__*/React.createElement("p", {
    key: status,
    "aria-live": "polite",
    style: {
      margin: '22px 0 0',
      fontSize: 'clamp(17px,1.6vw,22px)',
      lineHeight: 1.45,
      color: 'var(--rs-ink-2)',
      maxWidth: 560,
      minHeight: 32,
      textWrap: 'balance',
      animation: 'rsFadeUp .5s ease both'
    }
  }, paused ? 'Suche pausiert.' : status), pending && /*#__PURE__*/React.createElement(Crd, {
    tone: "accent",
    size: "md",
    style: {
      marginTop: 26,
      width: 'min(680px,100%)',
      animation: 'rsFadeUp .4s ease both'
    }
  }, /*#__PURE__*/React.createElement(Ovl, {
    tone: "accent",
    style: {
      letterSpacing: '.14em'
    }
  }, "Freigabe n\xF6tig"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      fontSize: 14,
      color: 'var(--rs-ink-6)'
    }
  }, "An: ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--rs-ink-2)'
    }
  }, pending.to)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      padding: '14px 16px',
      borderRadius: 12,
      background: 'var(--rs-surface-subtle)',
      fontSize: 15,
      lineHeight: 1.55
    }
  }, pending.text), pending.reason === 'contact' && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      fontSize: 13.5,
      color: 'var(--rs-ink-4)'
    }
  }, "Anschreiben ist in deinem Handlungsspielraum deaktiviert. Diese Nachricht geht nur mit deiner ausdr\xFCcklichen Freigabe raus."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      display: 'flex',
      gap: 12,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    size: "sm",
    onClick: () => {
      setPending(null);
      setWaitingFor(null);
      setAp({
        kind: 'contact'
      });
    }
  }, "Nachricht freigeben"), /*#__PURE__*/React.createElement(Btn, {
    variant: "link",
    size: "2xs",
    style: {
      fontSize: 14
    },
    onClick: () => openSettings('autonomy')
  }, "Handlungsspielraum \xE4ndern"))), waitingFor === 'source' && /*#__PURE__*/React.createElement(Btn, {
    variant: "secondary",
    size: "xs",
    style: {
      marginTop: 14
    },
    onClick: () => openSettings('sources')
  }, "Quelle ausw\xE4hlen"), waitingFor === 'access' && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: 14,
      color: 'var(--rs-ink-2)',
      flexWrap: 'wrap',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Dot2, {
    tone: "warning",
    style: {
      fontSize: 14
    }
  }, "Dein Portalzugang zu roomscout.dev braucht eine neue Anmeldung."), /*#__PURE__*/React.createElement(Btn, {
    variant: "link",
    size: "2xs",
    style: {
      color: 'var(--rs-ink)',
      padding: '4px 6px',
      fontSize: 14
    },
    onClick: () => openSettings('sources')
  }, "Zu den Zug\xE4ngen")), /*#__PURE__*/React.createElement(Pill, {
    size: "lg",
    icon: /*#__PURE__*/React.createElement(Ic, {
      name: "search",
      size: 18
    }),
    chevron: true,
    open: briefOpen,
    onClick: () => setBriefOpen(o => !o),
    style: {
      marginTop: 34
    }
  }, "Stuttgart \xB7 ", budget.replace('Bis ', 'bis ').replace(' / Monat', '')), briefOpen && /*#__PURE__*/React.createElement(Facts, {
    variant: "compact",
    facts: facts,
    style: {
      marginTop: 10
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    icon: /*#__PURE__*/React.createElement(Ic, {
      name: "clock",
      size: 18
    }),
    style: {
      marginTop: 22,
      fontSize: 15
    },
    onClick: () => setActOpen(o => !o)
  }, actOpen ? 'Aktivität ausblenden' : 'Aktivität ansehen'), actOpen && /*#__PURE__*/React.createElement(Crd, {
    size: "sm",
    tone: "faint",
    style: {
      width: 'min(420px,100%)',
      padding: '16px 20px',
      animation: 'rsFadeUp .3s ease both'
    }
  }, activity.map((a, k) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: 'grid',
      gridTemplateColumns: '14px 1fr',
      gap: 12,
      alignItems: 'start',
      padding: '7px 0'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      marginTop: 6,
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: k === activity.length - 1 ? 'var(--rs-orange)' : 'rgba(255,220,190,.35)',
      justifySelf: 'center'
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15
    }
  }, a.text), a.meta && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--rs-ink-6)',
      marginTop: 2
    }
  }, a.meta))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 42,
      width: 'min(660px,100%)'
    }
  }, /*#__PURE__*/React.createElement(Comp, {
    value: note,
    onChange: setNote,
    onSubmit: () => {
      if (!note.trim()) return;
      setNote('');
      showHint('Prototyp: Zusätzliche Hinweise werden hier nicht interpretiert. Der Scout arbeitet mit dem Suchauftrag weiter.');
    },
    onVoice: () => showHint('Prototyp: Das Mikrofon ist simuliert. Die Demo läuft ohne Spracheingabe weiter.'),
    divider: true,
    placeholder: "M\xF6chtest du mir noch etwas sagen?",
    height: 62
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22,
      fontSize: 14,
      color: 'var(--rs-ink-6)'
    }
  }, "Du kannst die App schlie\xDFen. Ich melde mich."));
}
function Clarification({
  go,
  setFacts,
  setTranscript,
  setAp,
  addActivity,
  showHint
}) {
  const [answer, setAnswer] = React.useState(null);
  const [draft, setDraft] = React.useState('');
  const timer = React.useRef(null);
  React.useEffect(() => () => clearTimeout(timer.current), []);
  const reply = (yes, text) => {
    setAnswer(yes ? 'yes' : 'no');
    setTranscript(t => t.concat([{
      who: 'user',
      text
    }, {
      who: 'scout',
      text: yes ? 'Alles klar, Mittwoch geht also auch. Ich kläre den Rest.' : 'Verstanden. Donnerstag bleibt gesetzt. Ich frage nach einer passenden Alternative und suche weiter.'
    }]));
    if (yes) setFacts(f => f.map(x => x.id === 'zeit' ? {
      ...x,
      label: 'Mittwoch oder Donnerstag ab 19 Uhr',
      changed: true
    } : x));
    timer.current = setTimeout(() => {
      addActivity(yes ? ACT.confirmed : ACT.alt);
      setAp(yes ? {
        kind: 'follow'
      } : {
        kind: 'alt'
      });
      go('scouting');
    }, 3200);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '16px 24px 32px',
      animation: 'rsFadeUp .6s ease both'
    }
  }, /*#__PURE__*/React.createElement(Blob2, {
    size: 118,
    state: "listening",
    style: {
      marginBottom: 34
    }
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 'clamp(34px,4.6vw,52px)',
      lineHeight: 1.1,
      fontWeight: 300,
      letterSpacing: '-.02em'
    }
  }, "Eine kurze R\xFCckfrage."), /*#__PURE__*/React.createElement(Crd, {
    size: "lg",
    tone: "soft",
    style: {
      marginTop: 28,
      width: 'min(740px,100%)',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement(Ovl, null, "Raum in Stuttgart-West"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      fontSize: 'clamp(24px,2.6vw,34px)',
      lineHeight: 1.2,
      fontWeight: 300,
      letterSpacing: '-.01em',
      textWrap: 'balance'
    }
  }, "Donnerstag ist leider belegt. W\xE4re Mittwoch ab 19 Uhr auch m\xF6glich?"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      fontSize: 16,
      color: 'var(--rs-ink-4)'
    }
  }, "280 \u20AC inklusive Nebenkosten. Euer Schlagzeug kann im Raum bleiben."), !answer && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "tint",
    size: "sm",
    onClick: () => reply(true, 'Ja, Mittwoch passt auch.')
  }, "Ja, Mittwoch passt"), /*#__PURE__*/React.createElement(Btn, {
    variant: "secondary",
    size: "sm",
    onClick: () => reply(false, 'Nein, Donnerstag ist wichtig.')
  }, "Nein, Donnerstag ist wichtig"))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 'min(740px,100%)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      marginTop: 18
    }
  }, answer && /*#__PURE__*/React.createElement(Bubble, {
    who: "user"
  }, answer === 'yes' ? 'Ja, Mittwoch passt auch.' : 'Nein, Donnerstag ist wichtig.'), answer && /*#__PURE__*/React.createElement(Bubble, {
    who: "scout",
    style: {
      animationDelay: '.6s',
      opacity: 0,
      animationFillMode: 'both'
    }
  }, answer === 'yes' ? 'Alles klar, Mittwoch geht also auch. Ich kläre den Rest.' : 'Verstanden. Donnerstag bleibt gesetzt. Ich frage nach einer passenden Alternative und suche weiter.')), !answer && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22,
      width: 'min(740px,100%)',
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 240
    }
  }, /*#__PURE__*/React.createElement(Comp, {
    value: draft,
    onChange: setDraft,
    onSubmit: () => {
      const l = draft.trim().toLowerCase();
      if (!l) return;
      if (/\bnein\b|nicht|donnerstag ist wichtig/.test(l)) reply(false, draft.trim());else if (/mittwoch|\bja\b|passt|ok|gern|klar/.test(l)) reply(true, draft.trim());else showHint('Prototyp: Diese Antwort wird nicht interpretiert. Antworte mit „Ja, Mittwoch passt“ oder „Nein, Donnerstag ist wichtig“.');
    },
    showKeyboardIcon: false,
    height: 58
  })), /*#__PURE__*/React.createElement(Btn, {
    variant: "secondary",
    size: "lg",
    icon: /*#__PURE__*/React.createElement(Ic, {
      name: "mic",
      size: 18
    }),
    style: {
      height: 58,
      fontSize: 15
    },
    onClick: () => showHint('Prototyp: Das Mikrofon ist simuliert. Antworte per Klick oder Text.')
  }, "Sprechen")));
}
const CHECK = /*#__PURE__*/React.createElement(Ic, {
  name: "check",
  size: 18,
  color: "var(--rs-orange)"
});
function Offer({
  go,
  facts,
  offer,
  offerStale,
  openSettings,
  narrow
}) {
  const [briefOpen, setBriefOpen] = React.useState(false);
  const [talk, setTalk] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '20px 24px 32px'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: '0 0 30px',
      fontSize: 'clamp(34px,4.6vw,52px)',
      lineHeight: 1.1,
      fontWeight: 300,
      letterSpacing: '-.02em',
      animation: 'rsFadeUp .6s ease both'
    }
  }, "Ein Raum, der zu euch passt."), offerStale && /*#__PURE__*/React.createElement(Ntc, {
    style: {
      margin: '-12px 0 22px'
    },
    action: /*#__PURE__*/React.createElement(Btn, {
      variant: "link",
      size: "2xs",
      style: {
        color: 'var(--rs-ink)',
        padding: '2px 4px',
        fontSize: 14
      },
      onClick: () => openSettings('knowledge')
    }, "Angaben ansehen")
  }, "Nach deiner \xC4nderung muss das Angebot erneut gepr\xFCft werden."), /*#__PURE__*/React.createElement(Crd, {
    size: "xl",
    padding: 0,
    style: {
      width: 'min(1190px,100%)',
      display: 'grid',
      gridTemplateColumns: narrow ? '1fr' : 'minmax(0,1fr) minmax(0,1.05fr)',
      overflow: 'hidden',
      animation: 'rsFadeUp .7s .1s ease both'
    }
  }, offer.photo ? /*#__PURE__*/React.createElement("img", {
    src: '../../' + offer.photo,
    alt: "Proberaum mit Schlagzeug und Akustikpaneelen",
    style: {
      display: 'block',
      width: '100%',
      height: '100%',
      minHeight: narrow ? 200 : 380,
      maxHeight: narrow ? 240 : 470,
      objectFit: 'cover'
    }
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: narrow ? 200 : 380,
      height: '100%',
      background: 'repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 10px,rgba(255,255,255,.02) 10px 20px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      color: 'var(--rs-ink-6)'
    }
  }, "Foto folgt vom Anbieter"), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'clamp(24px,3vw,44px) clamp(24px,3.4vw,56px)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Ovl, {
    tone: "accent"
  }, "Angebot eingegangen"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      fontSize: 'clamp(24px,2.4vw,32px)',
      letterSpacing: '-.01em'
    }
  }, "Euer ", offer.name), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 'clamp(38px,3.8vw,52px)',
      letterSpacing: '-.02em',
      lineHeight: 1.1
    }
  }, offer.price.split(' ')[0], " \u20AC ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '.6em',
      color: 'var(--rs-ink-2)'
    }
  }, "/ Monat")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 18,
      color: 'var(--rs-ink-4)'
    }
  }, "inklusive Nebenkosten"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      fontSize: 17
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, CHECK, offer.time), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, CHECK, offer.storage)), /*#__PURE__*/React.createElement(Btn, {
    size: "md",
    style: {
      marginTop: 30,
      alignSelf: 'flex-start',
      padding: '0 40px',
      height: 54
    },
    onClick: () => go('offer_review')
  }, "Angebot pr\xFCfen"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      fontSize: 14,
      color: 'var(--rs-ink-6)'
    }
  }, "Vor einer Zusage schauen wir uns alle Konditionen an."))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 34,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 22,
      flexWrap: 'wrap',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Blob2, {
    size: 58,
    state: talk ? 'speaking' : 'idle'
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 19
    }
  }, talk ? 'Dein Scout' : 'Soll ich euch das Angebot erklären?')), talk ? /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 620,
      fontSize: 17,
      lineHeight: 1.5,
      animation: 'rsFadeUp .4s ease both'
    }
  }, OFFER_TALK) : /*#__PURE__*/React.createElement(Btn, {
    variant: "secondary",
    size: "base",
    icon: /*#__PURE__*/React.createElement(Ic, {
      name: "mic",
      size: 18
    }),
    style: {
      height: 52,
      fontSize: 16
    },
    onClick: () => setTalk(true)
  }, "Mit Scout sprechen")), briefOpen && /*#__PURE__*/React.createElement(Facts, {
    variant: "compact",
    facts: facts,
    style: {
      marginTop: 28
    }
  }), /*#__PURE__*/React.createElement(Pill, {
    icon: /*#__PURE__*/React.createElement(Ic, {
      name: "list",
      size: 16
    }),
    chevron: true,
    open: briefOpen,
    onClick: () => setBriefOpen(o => !o),
    style: {
      marginTop: briefOpen ? 10 : 34
    }
  }, "Suchauftrag"));
}
function Review({
  go,
  offer,
  showHint
}) {
  const [terms, setTerms] = React.useState(false);
  const [qOpen, setQOpen] = React.useState(false);
  const [qa, setQa] = React.useState(null);
  const [qDraft, setQDraft] = React.useState('');
  const rows = ['Geteilter Raum · 4 Personen', offer.time, 'Schlagzeug-Lagerung bestätigt', 'Beginn: 1. Oktober 2026', 'Keine Kaution', 'Kündigungsfrist: ein Monat zum Monatsende'];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '20px 24px 32px',
      animation: 'rsFadeUp .5s ease both'
    }
  }, /*#__PURE__*/React.createElement(Blob2, {
    size: 64,
    state: qa ? 'speaking' : 'idle',
    style: {
      marginBottom: 22
    }
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: '0 0 26px',
      fontSize: 'clamp(34px,4.6vw,52px)',
      lineHeight: 1.1,
      fontWeight: 300,
      letterSpacing: '-.02em'
    }
  }, "Passt das f\xFCr euch?"), /*#__PURE__*/React.createElement(Crd, {
    size: "xl",
    style: {
      width: 'min(720px,100%)',
      padding: '28px clamp(22px,3vw,36px) 30px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: '../../' + (offer.photo || 'assets/proberaum.png'),
    alt: "",
    style: {
      width: 112,
      height: 84,
      objectFit: 'cover',
      borderRadius: 12,
      flex: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Ovl, null, offer.name), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 26,
      letterSpacing: '-.01em'
    }
  }, offer.price, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      color: 'var(--rs-ink-4)'
    }
  }, "inklusive Nebenkosten")))), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '24px 0 0',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
      gap: '10px 24px',
      fontSize: 16
    }
  }, rows.map(r => /*#__PURE__*/React.createElement("div", {
    key: r,
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      marginTop: 2
    }
  }, CHECK), r))), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "2xs",
    style: {
      marginTop: 18,
      fontSize: 14,
      padding: '6px 0'
    },
    onClick: () => setTerms(t => !t)
  }, terms ? 'Vollständige Bedingungen ausblenden' : 'Vollständige Bedingungen anzeigen', /*#__PURE__*/React.createElement(Ic, {
    name: "chevron-down",
    size: 14,
    style: {
      transform: terms ? 'rotate(180deg)' : 'none',
      transition: 'transform .3s'
    }
  })), terms && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      padding: '16px 18px',
      borderRadius: 14,
      background: 'var(--rs-surface-subtle)',
      fontSize: 14.5,
      lineHeight: 1.6,
      color: 'var(--rs-ink-2)',
      animation: 'rsFadeUp .3s ease both'
    }
  }, "Geteilte Nutzung des Raums in Stuttgart-West durch vier Bandmitglieder, mittwochs 19\u201322 Uhr. Miete 280 \u20AC monatlich inklusive Nebenkosten, Beginn 1. Oktober 2026. Keine Kaution. K\xFCndigungsfrist ein Monat zum Monatsende. Das eigene Schlagzeug darf dauerhaft im Raum gelagert werden. Verst\xE4rker werden von der Band mitgebracht.", /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      fontSize: 12.5,
      color: 'var(--rs-ink-6)'
    }
  }, "Demo-Bedingungen. Im echten Produkt w\xE4re hier das vollst\xE4ndige Angebot des Anbieters einsehbar.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 26,
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    size: "md",
    block: true,
    onClick: () => go('complete')
  }, "Angebot annehmen"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      lineHeight: 1.5,
      color: 'var(--rs-ink-4)',
      textAlign: 'center'
    }
  }, "Mit deiner Best\xE4tigung w\xFCrde der Scout dem Anbieter verbindlich zusagen. In dieser Demo wird nichts versendet."))), /*#__PURE__*/React.createElement(Btn, {
    variant: "link",
    style: {
      marginTop: 20,
      fontSize: 15
    },
    onClick: () => setQOpen(o => !o)
  }, "Noch eine Frage kl\xE4ren"), qOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      width: 'min(720px,100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 12,
      animation: 'rsFadeUp .3s ease both'
    }
  }, !qa && /*#__PURE__*/React.createElement(Btn, {
    variant: "tint",
    size: "2xs",
    style: {
      fontWeight: 400
    },
    onClick: () => setQa({
      q: 'Was passiert nach der Zusage?',
      a: QA_A
    })
  }, "Was passiert nach der Zusage?"), qa && /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Bubble, {
    who: "user",
    compact: true,
    style: {
      fontSize: 16
    }
  }, qa.q), /*#__PURE__*/React.createElement(Bubble, {
    who: "scout",
    style: {
      fontSize: 16
    }
  }, qa.a)), /*#__PURE__*/React.createElement(Comp, {
    value: qDraft,
    onChange: setQDraft,
    onSubmit: () => {
      const t = qDraft.trim();
      if (!t) return;
      setQDraft('');
      if (/zusage|danach|passiert|dann/.test(t.toLowerCase())) setQa({
        q: t,
        a: QA_A
      });else showHint('Prototyp: Freie Fragen werden hier nicht interpretiert. Nutze die vorbereitete Frage.');
    },
    showKeyboardIcon: false,
    placeholder: "Frage an deinen Scout \u2026",
    height: 56
  })));
}
function Complete({
  go,
  offer
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '24px 24px 40px'
    }
  }, /*#__PURE__*/React.createElement(Blob2, {
    size: 96,
    style: {
      marginBottom: 40
    }
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 'clamp(36px,5vw,58px)',
      lineHeight: 1.08,
      fontWeight: 300,
      letterSpacing: '-.02em',
      maxWidth: 720,
      textWrap: 'balance',
      animation: 'rsFadeUp .6s ease both'
    }
  }, "Euer n\xE4chster Proberaum steht bereit."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22,
      fontSize: 17,
      color: 'var(--rs-ink-4)',
      animation: 'rsFadeUp .6s .1s ease both'
    }
  }, "Demo abgeschlossen \u2014 es wurde keine echte Zusage versendet."), /*#__PURE__*/React.createElement(Pill, {
    size: "md",
    style: {
      marginTop: 28,
      height: 46,
      color: 'var(--rs-ink)',
      fontSize: 15,
      animation: 'rsFadeUp .6s .2s ease both'
    }
  }, offer.short, " \xB7 ", offer.price, " \xB7 ", offer.timeLower), /*#__PURE__*/React.createElement(Btn, {
    variant: "link",
    style: {
      marginTop: 40,
      fontSize: 15,
      animation: 'rsFadeUp .6s .3s ease both'
    },
    onClick: () => go('welcome', {
      reset: true
    })
  }, "Demo erneut ansehen"));
}
Object.assign(window, {
  Autopilot,
  Clarification,
  Offer,
  Review,
  Complete,
  ACT
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/roomscout-app/ScreensB.jsx", error: String((e && e.message) || e) }); }

// ui_kits/roomscout-app/ScreensC.jsx
try { (() => {
const DS4 = window.RoomScoutDesignSystem_e8f376;
const {
  ScoutBlob: Blob4,
  Button: Btn4,
  Icon: Ic4,
  Card: Crd4,
  Overline: Ovl4,
  Badge: Bdg4,
  FactList: Facts4,
  SummaryPill: Pill4
} = DS4;
const CANDS = [{
  id: 'west',
  name: 'Raum in Stuttgart-West',
  short: 'Stuttgart-West',
  price: '280 € / Monat',
  priceNum: 280,
  time: 'Mittwochs, 19–22 Uhr',
  timeLower: 'mittwochs 19–22 Uhr',
  storage: 'Schlagzeug kann im Raum bleiben',
  storageOk: true,
  way: '12 Min. mit der Stadtbahn',
  size: 'ca. 28 m² · geteilt mit einer Band',
  note: 'Günstigster Raum, aber nur mittwochs frei.',
  photo: 'assets/proberaum.png'
}, {
  id: 'esslingen',
  name: 'Raum in Esslingen',
  short: 'Esslingen',
  price: '320 € / Monat',
  priceNum: 320,
  time: 'Donnerstags, 19–23 Uhr',
  timeLower: 'donnerstags 19–23 Uhr',
  storage: 'Schlagzeug kann im Raum bleiben',
  storageOk: true,
  way: '25 Min. mit der S-Bahn',
  size: 'ca. 35 m² · geteilt mit zwei Bands',
  note: 'Euer Wunschtag, dafür im Umland.',
  photo: null
}, {
  id: 'ost',
  name: 'Raum in Stuttgart-Ost',
  short: 'Stuttgart-Ost',
  price: '350 € / Monat',
  priceNum: 350,
  time: 'Donnerstags, ab 20 Uhr',
  timeLower: 'donnerstags ab 20 Uhr',
  storage: 'Schlagzeug müsste abgebaut werden',
  storageOk: false,
  way: '18 Min. mit der Stadtbahn',
  size: 'ca. 22 m² · geteilt mit drei Bands',
  note: 'Am Budgetlimit, und das Schlagzeug kann nicht bleiben.',
  photo: null
}];

/* 7b · Sackgasse: the Scout can't proceed; the band picks a compromise. */
function DeadEnd({
  go,
  facts,
  setFacts,
  setAp,
  setTranscript,
  addActivity,
  logChange
}) {
  const budgetNum = Number(((facts.find(f => f.id === 'budget') || {}).label || '350').replace(/\D/g, '')) || 350;
  const opts = [{
    k: 'budget',
    t: 'Budget bis ' + (budgetNum + 50) + ' €',
    s: 'Erweitert die Suche in Stuttgart um weitere Räume.',
    fid: 'budget',
    label: 'Bis ' + (budgetNum + 50) + ' € / Monat',
    line: 'Alles klar, bis ' + (budgetNum + 50) + ' Euro. Ich suche erneut in Stuttgart.'
  }, {
    k: 'umland',
    t: 'Umland einbeziehen',
    s: 'Esslingen, Ludwigsburg, Fellbach · 20 bis 30 Minuten Weg.',
    fid: 'ort',
    label: 'Stuttgart & Umland',
    line: 'Alles klar, ich beziehe das Umland ein: Esslingen, Ludwigsburg und Fellbach.'
  }, {
    k: 'zeit',
    t: 'Mittwoch doch erlauben',
    s: 'Der Raum in Stuttgart-West wäre dann verfügbar. Donnerstag bleibt gemerkt.',
    fid: 'zeit',
    label: 'Mittwoch oder Donnerstag ab 19 Uhr',
    line: 'Alles klar, Mittwoch geht also auch. Ich frage den Raum in Stuttgart-West erneut an.'
  }];
  const pick = o => {
    setFacts(f => f.map(x => x.id === o.fid ? {
      ...x,
      label: o.label,
      changed: true
    } : x));
    setTranscript(t => t.concat([{
      who: 'scout',
      text: o.line
    }]));
    addActivity({
      text: 'Suchauftrag angepasst: ' + o.label
    });
    logChange('Suchauftrag angepasst: ' + o.label);
    setAp({
      kind: 'compromise',
      target: o.k,
      line: o.line
    });
    go('scouting');
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '16px 24px 32px',
      animation: 'rsFadeUp .5s ease both'
    }
  }, /*#__PURE__*/React.createElement(Blob4, {
    size: 110,
    style: {
      marginBottom: 30
    }
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 'clamp(32px,4.6vw,52px)',
      lineHeight: 1.1,
      fontWeight: 300,
      letterSpacing: '-.02em',
      textWrap: 'balance'
    }
  }, "Da komme ich gerade nicht weiter."), /*#__PURE__*/React.createElement(Crd4, {
    size: "lg",
    tone: "soft",
    style: {
      marginTop: 26,
      width: 'min(700px,100%)',
      padding: '28px 30px'
    }
  }, /*#__PURE__*/React.createElement(Ovl4, null, "Raum in Stuttgart-West"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      fontSize: 'clamp(19px,2vw,24px)',
      lineHeight: 1.35,
      fontWeight: 300
    }
  }, "Der Anbieter kann Donnerstag nicht anbieten. Weitere R\xE4ume in Stuttgart, die zu eurem Suchauftrag passen, habe ich aktuell nicht gefunden."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22,
      fontSize: 15,
      color: 'var(--rs-ink-4)'
    }
  }, "Was w\xE4re f\xFCr euch denkbar? Ich passe den Suchauftrag nur an, wenn ihr es sagt."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, opts.map(o => /*#__PURE__*/React.createElement(OptionRow, {
    key: o.k,
    title: o.t,
    sub: o.s,
    onClick: () => pick(o)
  })))), /*#__PURE__*/React.createElement(Btn4, {
    variant: "link",
    style: {
      marginTop: 20,
      fontSize: 15
    },
    onClick: () => {
      setAp({
        kind: 'keep',
        line: 'Alles klar, ich suche im Hintergrund weiter und melde mich.'
      });
      go('scouting');
    }
  }, "Nichts \xE4ndern, weiter suchen lassen"));
}
function OptionRow({
  title,
  sub,
  onClick
}) {
  const [h, setH] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 16,
      padding: '14px 16px',
      borderRadius: 14,
      border: '1px solid var(--rs-border-panel)',
      background: h ? 'rgba(255,255,255,.09)' : 'var(--rs-surface-subtle)',
      color: 'var(--rs-ink)',
      fontFamily: 'inherit',
      textAlign: 'left',
      cursor: 'pointer',
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 17
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginTop: 2,
      fontSize: 14,
      color: 'var(--rs-ink-4)'
    }
  }, sub)), /*#__PURE__*/React.createElement(Ic4, {
    name: "chevron-right",
    size: 18
  }));
}

/* 7c · Kandidaten: three rooms side by side; the band decides where the Scout asks. */
function Candidates({
  go,
  facts,
  setOffer,
  setAp,
  addActivity,
  narrow
}) {
  const [briefOpen, setBriefOpen] = React.useState(false);
  const budgetNum = Number(((facts.find(f => f.id === 'budget') || {}).label || '350').replace(/\D/g, '')) || 350;
  const ort = (facts.find(f => f.id === 'ort') || {}).label || 'Stuttgart';
  const list = CANDS.map(c => ({
    ...c,
    fits: c.priceNum <= budgetNum,
    inArea: c.id !== 'esslingen' || /Umland/.test(ort)
  }));
  const best = list.filter(c => c.fits && c.storageOk && c.inArea).sort((a, b) => a.priceNum - b.priceNum)[0];
  const pick = c => {
    setOffer(c);
    addActivity({
      text: 'Angebot angefragt: ' + c.short
    });
    setAp({
      kind: 'follow',
      line: 'Ich frage beim ' + c.name + ' nach einem Angebot und kläre die Details.'
    });
    go('scouting');
  };
  const row = (icon, text, muted) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      color: muted ? 'var(--rs-ink-4)' : 'inherit'
    }
  }, icon, text);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '20px 24px 32px'
    }
  }, /*#__PURE__*/React.createElement(Blob4, {
    size: 72,
    style: {
      marginBottom: 22
    }
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 'clamp(32px,4.6vw,52px)',
      lineHeight: 1.1,
      fontWeight: 300,
      letterSpacing: '-.02em',
      textWrap: 'balance'
    }
  }, "Drei R\xE4ume, die in Frage kommen."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '12px 0 0',
      fontSize: 17,
      color: 'var(--rs-ink-4)'
    }
  }, "Ich habe die Unterschiede nebeneinander gelegt. Ihr entscheidet, wo ich anfrage."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 28,
      width: 'min(1180px,100%)',
      display: 'grid',
      gridTemplateColumns: narrow ? '1fr' : 'repeat(3, minmax(0,1fr))',
      gap: 14,
      textAlign: 'left',
      animation: 'rsFadeUp .6s .1s ease both'
    }
  }, list.map(c => {
    const isBest = best && best.id === c.id;
    return /*#__PURE__*/React.createElement(Crd4, {
      key: c.id,
      size: "lg",
      padding: 0,
      style: {
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        borderColor: isBest ? 'var(--rs-border-accent)' : undefined
      }
    }, isBest && /*#__PURE__*/React.createElement(Bdg4, {
      style: {
        position: 'absolute',
        top: 14,
        left: 14,
        zIndex: 2
      }
    }, "Mein Vorschlag"), c.photo ? /*#__PURE__*/React.createElement("img", {
      src: '../../' + c.photo,
      alt: "",
      style: {
        display: 'block',
        width: '100%',
        height: 150,
        objectFit: 'cover'
      }
    }) : /*#__PURE__*/React.createElement("div", {
      style: {
        height: 150,
        background: 'repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 10px,rgba(255,255,255,.02) 10px 20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 12.5,
        color: 'var(--rs-ink-6)'
      }
    }, "Foto folgt vom Anbieter"), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '20px 22px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 19
      }
    }, c.name), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 4,
        fontSize: 30,
        letterSpacing: '-.02em'
      }
    }, c.price), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 2,
        fontSize: 13.5,
        color: c.fits ? 'var(--rs-ink-6)' : 'var(--rs-amber)'
      }
    }, c.fits ? 'Im Budget' : 'Über eurem Budget (' + budgetNum + ' €)')), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
        fontSize: 15,
        paddingTop: 12,
        borderTop: '1px solid var(--rs-border-divider)'
      }
    }, row(/*#__PURE__*/React.createElement(Ic4, {
      name: "clock",
      size: 18,
      color: "var(--rs-ink-2)",
      style: {
        marginTop: 1
      }
    }), c.time), row(c.storageOk ? /*#__PURE__*/React.createElement(Ic4, {
      name: "check",
      size: 18,
      color: "var(--rs-orange)",
      style: {
        marginTop: 1
      }
    }) : /*#__PURE__*/React.createElement(Ic4, {
      name: "close",
      size: 18,
      color: "var(--rs-amber)",
      style: {
        marginTop: 1
      }
    }), c.storage), row(/*#__PURE__*/React.createElement(Ic4, {
      name: "pin",
      size: 18,
      color: "var(--rs-ink-2)",
      style: {
        marginTop: 1
      }
    }), c.way), row(/*#__PURE__*/React.createElement(Ic4, {
      name: "home",
      size: 18,
      color: "var(--rs-ink-2)",
      style: {
        marginTop: 1
      }
    }), c.size, true)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        fontSize: 14.5,
        color: 'var(--rs-ink-2)',
        paddingTop: 10,
        borderTop: '1px solid var(--rs-border-divider)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        marginTop: 5,
        width: 10,
        height: 10,
        borderRadius: '46% 54% 52% 48%/55% 45% 55% 45%',
        background: 'var(--rs-orange)',
        flex: 'none',
        boxShadow: '0 0 8px rgba(255,105,38,.5)'
      }
    }), c.note), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement(Btn4, {
      size: "sm",
      variant: isBest ? 'primary' : 'secondary',
      block: true,
      style: {
        height: 48,
        fontWeight: 600,
        color: '#fff'
      },
      onClick: () => pick(c)
    }, "Diesen Raum anfragen")));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22,
      display: 'flex',
      gap: 18,
      alignItems: 'center',
      flexWrap: 'wrap',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Btn4, {
    variant: "link",
    style: {
      fontSize: 15
    },
    onClick: () => {
      setAp({
        kind: 'keep',
        line: 'Alles klar, ich suche weiter und melde mich, sobald sich etwas Neues ergibt.'
      });
      go('scouting');
    }
  }, "Keiner passt, weiter suchen"), /*#__PURE__*/React.createElement(Pill4, {
    size: "sm",
    chevron: true,
    open: briefOpen,
    onClick: () => setBriefOpen(o => !o),
    style: {
      height: 40
    }
  }, "Stuttgart \xB7 bis ", budgetNum, " \u20AC")), briefOpen && /*#__PURE__*/React.createElement(Facts4, {
    variant: "compact",
    facts: facts,
    style: {
      marginTop: 10
    }
  }));
}
Object.assign(window, {
  DeadEnd,
  Candidates,
  CANDS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/roomscout-app/ScreensC.jsx", error: String((e && e.message) || e) }); }

// ui_kits/roomscout-app/Settings.jsx
try { (() => {
const DS3 = window.RoomScoutDesignSystem_e8f376;
const {
  Card: SCard,
  NavItem: SNav,
  NavGroupLabel: SGroup,
  Icon: SIc,
  Switch: SSw,
  RadioCard: SRadio,
  Stepper: SStep,
  Overline: SOvl,
  Button: SBtn,
  StatusDot: SDot,
  Notice: SNotice,
  Badge: SBadge,
  TextInput: SInput,
  IconButton: SIcBtn,
  Avatar: SAvatar
} = DS3;
const SRC_META = {
  roomscout: {
    name: 'roomscout.dev',
    desc: 'Kontrolliertes Demo-Portal',
    logo: true
  },
  musiker: {
    name: 'Musiker in deiner Stadt',
    desc: 'Stuttgart · Öffentliche Anzeigen',
    icon: 'users'
  },
  bandnet: {
    name: 'Bandnet Hamburg',
    desc: 'Hamburg · Andere Region',
    icon: 'music'
  }
};
const SqBtn = ({
  children,
  onClick,
  primary,
  danger,
  disabled,
  style
}) => /*#__PURE__*/React.createElement("button", {
  onClick: onClick,
  disabled: disabled,
  style: {
    height: 46,
    padding: '0 22px',
    borderRadius: 12,
    border: primary || danger ? 0 : '1px solid var(--rs-border-control-strong)',
    background: primary ? disabled ? 'rgba(255,105,38,.4)' : 'var(--rs-orange)' : danger ? 'var(--rs-red)' : 'var(--rs-surface-subtle)',
    color: '#fff',
    fontFamily: 'inherit',
    fontSize: 15,
    fontWeight: primary || danger ? 600 : 400,
    cursor: disabled ? 'default' : 'pointer',
    ...style
  }
}, children);
const H1 = ({
  children
}) => /*#__PURE__*/React.createElement("h1", {
  style: {
    margin: 0,
    fontSize: 44,
    lineHeight: 1.1,
    fontWeight: 500,
    letterSpacing: '-.02em'
  }
}, children);
const Lead = ({
  children
}) => /*#__PURE__*/React.createElement("p", {
  style: {
    margin: '10px 0 0',
    fontSize: 19,
    color: 'var(--rs-ink-4)'
  }
}, children);
const Row = ({
  children,
  style
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    padding: '16px 0',
    borderBottom: '1px solid var(--rs-border-divider)',
    ...style
  }
}, children);
const Saved = ({
  show,
  text = 'Gespeichert'
}) => show ? /*#__PURE__*/React.createElement("span", {
  style: {
    fontSize: 13,
    color: 'var(--rs-ink-6)',
    animation: 'rsFadeUp .2s ease both'
  }
}, text) : null;
function SourceRow({
  s,
  flags,
  toggle,
  openConn
}) {
  const [open, setOpen] = React.useState(s.id === 'roomscout');
  const [saved, setSaved] = React.useState(false);
  const m = SRC_META[s.id];
  const status = s.kind === 'portal' ? s.access === 'connected' ? ['Verbunden', 'success'] : ['Anmeldung nötig', 'warning'] : s.enabled ? flags.publicSearch ? ['Öffentlich', 'muted'] : ['In dieser Demo nicht aktiv', 'muted'] : ['Ausgeschlossen', 'muted'];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 18,
      background: s.enabled ? 'rgba(255,255,255,.03)' : 'transparent',
      border: `1px solid ${s.enabled ? 'var(--rs-border-card-soft)' : 'transparent'}`,
      marginBottom: 8,
      transition: 'background .25s,border-color .25s'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '56px minmax(0,1fr) auto auto auto',
      alignItems: 'center',
      gap: 18,
      padding: '16px 16px 16px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      borderRadius: '50%',
      border: '1px solid var(--rs-border-control)',
      background: 'var(--rs-surface-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, m.logo ? /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-roomscout.png",
    alt: "",
    style: {
      width: 30,
      height: 30,
      objectFit: 'contain'
    }
  }) : /*#__PURE__*/React.createElement(SIc, {
    name: m.icon,
    size: 22
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 19
    }
  }, m.name), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 2,
      fontSize: 14.5,
      color: 'var(--rs-ink-4)'
    }
  }, m.desc)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(SDot, {
    tone: status[1]
  }, status[0]), /*#__PURE__*/React.createElement(Saved, {
    show: saved
  })), /*#__PURE__*/React.createElement(SSw, {
    checked: s.enabled,
    onChange: () => {
      toggle(s.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
    label: m.name
  }), /*#__PURE__*/React.createElement(SIcBtn, {
    variant: "bare",
    size: 36,
    label: "Details",
    "aria-expanded": open,
    onClick: () => setOpen(o => !o)
  }, /*#__PURE__*/React.createElement(SIc, {
    name: "chevron-down",
    size: 18,
    style: {
      transform: open ? 'rotate(180deg)' : 'none',
      transition: 'transform .25s'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateRows: open ? '1fr' : '0fr',
      transition: 'grid-template-rows .26s cubic-bezier(.3,.7,.2,1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: 'hidden',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '0 16px',
      padding: '16px 8px 18px',
      borderTop: '1px solid var(--rs-border-divider)',
      display: 'flex',
      justifyContent: 'space-between',
      gap: 20,
      fontSize: 15,
      lineHeight: 1.6,
      color: 'var(--rs-ink-2)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", null, s.id === 'roomscout' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--rs-ink)'
    }
  }, "Portalprofil: Herzbuben"), /*#__PURE__*/React.createElement("div", null, "Anzeigen lesen und Nachrichten austauschen")), s.id === 'musiker' && /*#__PURE__*/React.createElement(React.Fragment, null, "\xD6ffentliche Anzeigen k\xF6nnen ber\xFCcksichtigt werden. Der Kontaktweg h\xE4ngt von der Anzeige ab.", !flags.publicSearch && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement(SBadge, {
    variant: "muted"
  }, "In dieser Demo nicht aktiv"))), s.id === 'bandnet' && 'Hamburg liegt außerhalb eurer Suche. Eine Anmeldung ist dafür nicht nötig.', !s.enabled && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      color: 'var(--rs-ink-6)'
    }
  }, "Keine neuen Anfragen \xFCber diese Quelle. Vorhandene Gespr\xE4che bleiben sichtbar.")), s.kind === 'portal' && /*#__PURE__*/React.createElement(SBtn, {
    variant: "link",
    size: "2xs",
    style: {
      color: 'var(--rs-ink)',
      padding: '6px 4px',
      fontSize: 15,
      textDecorationColor: 'rgba(255,220,190,.4)'
    },
    onClick: openConn
  }, s.access === 'connected' ? 'Verbindung verwalten' : 'Erneut anmelden', " ", /*#__PURE__*/React.createElement(SIc, {
    name: "arrow-up-right",
    size: 14
  }))))));
}
function SourcesPage({
  d,
  A,
  setSheet
}) {
  const [saved, setSaved] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [more, setMore] = React.useState(false);
  const [q, setQ] = React.useState('');
  const usable = d.sources.filter(s => s.enabled && (s.kind === 'portal' || d.flags.publicSearch));
  const extra = [{
    name: 'Proberaum-Börse Süd',
    region: 'Baden-Württemberg',
    state: 'Nicht angebunden'
  }, {
    name: 'Bandraum München',
    region: 'München · Andere Region',
    state: 'Nicht angebunden'
  }].filter(x => !q || (x.name + x.region).toLowerCase().includes(q.toLowerCase()));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(H1, null, "Wo darf dein Scout suchen?"), /*#__PURE__*/React.createElement(Lead, null, d.hasOrder ? 'Für eure Suche in Stuttgart.' : 'Quellen gelten für eine konkrete Suche.'), !d.hasOrder && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 28,
      padding: '24px 26px',
      borderRadius: 18,
      background: 'var(--rs-surface-subtle)',
      border: '1px solid var(--rs-border-card)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 20,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18
    }
  }, "Lege zuerst einen Suchauftrag an."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4,
      fontSize: 14.5,
      color: 'var(--rs-ink-4)'
    }
  }, "Quellen gelten immer f\xFCr eine konkrete Suche. Deine Portalzug\xE4nge bleiben davon unabh\xE4ngig.")), /*#__PURE__*/React.createElement(SBtn, {
    size: "sm",
    onClick: A.back
  }, "Zum Scout")), d.hasOrder && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 26,
      padding: '22px 0',
      borderTop: '1px solid var(--rs-border-divider)',
      borderBottom: '1px solid var(--rs-border-divider)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20
    }
  }, "Passende Quellen automatisch ausw\xE4hlen"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4,
      fontSize: 15,
      color: 'var(--rs-ink-4)'
    }
  }, "Deine Ausschl\xFCsse bleiben erhalten.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Saved, {
    show: saved
  }), /*#__PURE__*/React.createElement(SSw, {
    checked: d.autoSources,
    onChange: v => {
      A.setAutoSources(v);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
    label: "Passende Quellen automatisch ausw\xE4hlen"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 26,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement(SOvl, null, "Deine Quellen"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--rs-ink-6)'
    }
  }, "F\xFCr diese Suche")), !usable.length && /*#__PURE__*/React.createElement(SNotice, {
    style: {
      marginTop: 14,
      padding: '14px 18px'
    },
    action: /*#__PURE__*/React.createElement(SBtn, {
      size: "2xs",
      onClick: () => A.toggleSource('roomscout')
    }, "Quelle ausw\xE4hlen")
  }, "Aktuell ist keine nutzbare Quelle ausgew\xE4hlt. Dein Scout kann so nicht weitersuchen."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, d.sources.map(s => /*#__PURE__*/React.createElement(SourceRow, {
    key: s.id,
    s: s,
    flags: d.flags,
    toggle: A.toggleSource,
    openConn: () => setSheet('conn')
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22,
      paddingTop: 22,
      borderTop: '1px solid var(--rs-border-divider)',
      display: 'grid',
      gridTemplateColumns: 'auto minmax(0,1fr) auto',
      gap: 20,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(SIc, {
    name: "mail",
    size: 26,
    style: {
      marginTop: 4
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18
    }
  }, "Deine Scout-Adresse"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4,
      fontSize: 17,
      userSelect: 'all'
    }
  }, d.name.toLowerCase(), "@scout.roomscout.dev"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 14.5,
      color: 'var(--rs-ink-4)'
    }
  }, "F\xFCr Portal-Anmeldungen und Antworten an deinen Scout.")), /*#__PURE__*/React.createElement(SqBtn, {
    onClick: () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    },
    style: {
      minWidth: 120
    }
  }, copied ? 'Kopiert' : 'Kopieren')), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 26,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 20,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(SBtn, {
    variant: "link",
    size: "2xs",
    style: {
      color: 'var(--rs-ink)',
      padding: '6px 0',
      fontSize: 15
    },
    onClick: () => setMore(m => !m)
  }, more ? 'Weitere Quellen ausblenden' : 'Weitere Quellen anzeigen'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--rs-ink-6)'
    }
  }, "Eine Quelle auszuschlie\xDFen l\xF6scht keinen Portal-Account.")), more && /*#__PURE__*/React.createElement(SCard, {
    size: "md",
    tone: "faint",
    style: {
      marginTop: 16,
      padding: '20px 22px',
      background: 'rgba(255,255,255,.03)',
      animation: 'rsFadeUp .2s ease both'
    }
  }, /*#__PURE__*/React.createElement(SInput, {
    value: q,
    onChange: setQ,
    placeholder: "Quelle oder Region suchen \u2026",
    label: "Quellen durchsuchen"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, extra.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.name,
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) auto auto',
      gap: 16,
      alignItems: 'center',
      padding: '14px 4px',
      borderBottom: '1px solid var(--rs-border-divider-soft)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16
    }
  }, m.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: 'var(--rs-ink-6)',
      marginTop: 2
    }
  }, m.region)), /*#__PURE__*/React.createElement(SDot, {
    tone: "muted",
    style: {
      fontSize: 14
    }
  }, m.state), /*#__PURE__*/React.createElement(SBtn, {
    variant: "secondary",
    size: "2xs",
    disabled: true,
    style: {
      minWidth: 130,
      fontSize: 14
    }
  }, "Vormerken"))), !extra.length && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 4px',
      fontSize: 14.5,
      color: 'var(--rs-ink-6)'
    }
  }, "Keine Quelle gefunden. Die Liste zeigt nur die vorhandenen Demo-Quellen.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      fontSize: 13,
      color: 'var(--rs-ink-6)'
    }
  }, "Demo-Quellen. Keine vollst\xE4ndige Liste aller Portale."))));
}
function AutonomyPage({
  d,
  A
}) {
  const [draft, setDraft] = React.useState(null);
  const [saved, setSaved] = React.useState(false);
  const [detA, setDetA] = React.useState(false);
  const [detB, setDetB] = React.useState(false);
  const [lim, setLim] = React.useState(false);
  const R = draft || d.rules;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(d.rules);
  const invalid = !(Number.isInteger(Number(R.perDay)) && Number(R.perDay) > 0);
  const set = patch => setDraft({
    ...R,
    ...patch
  });
  const SwRow = ({
    k,
    label
  }) => /*#__PURE__*/React.createElement(Row, {
    style: {
      padding: '14px 0',
      fontSize: 17
    }
  }, /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement(SSw, {
    checked: !!R[k],
    onChange: v => set({
      [k]: v
    }),
    label: label
  }));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(H1, null, "So arbeitet dein Scout"), /*#__PURE__*/React.createElement(Lead, null, "Du bestimmst, wie selbstst\xE4ndig ich vorgehe."), /*#__PURE__*/React.createElement("div", {
    role: "radiogroup",
    style: {
      marginTop: 26,
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(SRadio, {
    checked: R.mode === 'autopilot',
    onSelect: () => set({
      mode: 'autopilot'
    }),
    title: "Autopilot",
    description: "Suchen, anfragen und Details kl\xE4ren."
  }), /*#__PURE__*/React.createElement(SRadio, {
    checked: R.mode === 'review',
    onSelect: () => set({
      mode: 'review'
    }),
    title: "Mit R\xFCcksprache",
    description: "Nachrichten vor dem Versand pr\xFCfen."
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 30,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement(SOvl, null, "Was ich selbstst\xE4ndig erledigen darf"), /*#__PURE__*/React.createElement(SBtn, {
    variant: "ghost",
    size: "2xs",
    style: {
      color: 'var(--rs-ink-6)',
      fontSize: 13.5,
      padding: '2px 4px'
    },
    onClick: () => setDetA(x => !x)
  }, "Details")), detA && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      fontSize: 14,
      color: 'var(--rs-ink-4)',
      lineHeight: 1.6,
      animation: 'rsFadeUp .2s ease both'
    }
  }, "Anschreiben umfasst Erstanfragen und Nachfragen zu Verf\xFCgbarkeit, Preis und Ausstattung. Besichtigungen werden nur vorgeschlagen, nie verbindlich zugesagt. Eine eigene Suchanzeige w\xE4re \xF6ffentlich sichtbar und enth\xE4lt nur freigegebene Informationen."), /*#__PURE__*/React.createElement(SwRow, {
    k: "contact",
    label: "Anbieter anschreiben"
  }), /*#__PURE__*/React.createElement(SwRow, {
    k: "viewings",
    label: "Besichtigungen vorschlagen"
  }), /*#__PURE__*/React.createElement(SwRow, {
    k: "publishAd",
    label: "Eigene Suchanzeige ver\xF6ffentlichen"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 30,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement(SOvl, null, "Was ich teilen darf"), /*#__PURE__*/React.createElement(SBtn, {
    variant: "ghost",
    size: "2xs",
    style: {
      color: 'var(--rs-ink-6)',
      fontSize: 13.5,
      padding: '2px 4px'
    },
    onClick: () => setDetB(x => !x)
  }, "Details")), detB && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      fontSize: 14,
      color: 'var(--rs-ink-4)',
      lineHeight: 1.6,
      animation: 'rsFadeUp .2s ease both'
    }
  }, "Bandprofil: Bandname, Besetzung, Musikrichtung, gew\xFCnschte Probezeiten und die Scout-Adresse. Privat: pers\xF6nliche Telefonnummern und genaue Wohnadressen. Diese Freigabe gilt unabh\xE4ngig vom Arbeitsmodus."), /*#__PURE__*/React.createElement(SwRow, {
    k: "shareProfile",
    label: "Bandprofil weitergeben"
  }), /*#__PURE__*/React.createElement(SwRow, {
    k: "sharePrivate",
    label: "Private Kontaktdaten weitergeben"
  }), /*#__PURE__*/React.createElement(SOvl, {
    style: {
      marginTop: 30
    }
  }, "Grenzen"), /*#__PURE__*/React.createElement(Row, {
    style: {
      padding: '14px 0',
      fontSize: 17,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Neue Anbieter pro Tag"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 22,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(SStep, {
    value: R.perDay,
    onChange: v => set({
      perDay: v
    }),
    label: "Neue Anbieter pro Tag"
  }), /*#__PURE__*/React.createElement(SBtn, {
    variant: "link",
    size: "2xs",
    style: {
      color: 'var(--rs-ink)',
      fontSize: 15,
      padding: '6px 2px'
    },
    onClick: () => setLim(x => !x)
  }, "Weitere Grenzen ", /*#__PURE__*/React.createElement(SIc, {
    name: "chevron-right",
    size: 14,
    style: {
      transform: lim ? 'rotate(90deg)' : 'none',
      transition: 'transform .25s'
    }
  })))), invalid && /*#__PURE__*/React.createElement("div", {
    role: "alert",
    style: {
      marginTop: 8,
      fontSize: 14,
      color: 'var(--rs-red-text)'
    }
  }, "Bitte eine ganze Zahl gr\xF6\xDFer als 0 eingeben."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 13.5,
      color: 'var(--rs-ink-6)'
    }
  }, "Gemeint sind neue kontaktierte Anbieter, nicht die Nachrichten in einer laufenden Unterhaltung."), lim && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      padding: '16px 20px',
      borderRadius: 14,
      background: 'rgba(255,255,255,.03)',
      border: '1px solid var(--rs-border-card-soft)',
      fontSize: 15,
      lineHeight: 1.7,
      color: 'var(--rs-ink-2)',
      animation: 'rsFadeUp .2s ease both'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--rs-ink-6)'
    }
  }, "Suchzeitraum:"), " bis ihr den Suchauftrag beendet oder ein Angebot annehmt."), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--rs-ink-6)'
    }
  }, "Geltende Stopps:"), " Suche jederzeit im Hauptbereich pausierbar; verbindliche Zusagen nie automatisch."), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--rs-ink-6)'
    }
  }, "Budget:"), " geh\xF6rt zum Suchauftrag.")), /*#__PURE__*/React.createElement(SCard, {
    tone: "rust",
    size: "md",
    style: {
      marginTop: 26,
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      padding: '20px 24px'
    }
  }, /*#__PURE__*/React.createElement(SIc, {
    name: "lock",
    size: 26,
    color: "var(--rs-orange-light)"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 500
    }
  }, "Verbindliche Entscheidungen bleiben bei dir."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 3,
      fontSize: 14.5,
      color: 'var(--rs-ink-4)'
    }
  }, "Vertr\xE4ge, Buchungen und Zahlungen brauchen immer deine Freigabe."))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22,
      minHeight: 52,
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 12
    }
  }, saved && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14.5,
      color: 'var(--rs-ink-4)',
      marginRight: 'auto',
      animation: 'rsFadeUp .2s ease both'
    }
  }, "Handlungsspielraum aktualisiert"), dirty && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SqBtn, {
    onClick: () => setDraft(null),
    style: {
      height: 48
    }
  }, "Abbrechen"), /*#__PURE__*/React.createElement(SqBtn, {
    primary: true,
    disabled: invalid,
    onClick: () => {
      A.saveRules({
        ...R,
        perDay: Number(R.perDay)
      });
      setDraft(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2600);
    },
    style: {
      height: 48
    }
  }, "\xC4nderungen speichern"))));
}
const CATS = {
  band: 'Eure Band',
  alltag: 'Alltag & Wege',
  ausstattung: 'Ausstattung'
};
const KICON = {
  band: 'users',
  budget: null,
  ort: 'pin',
  zeit: 'clock',
  equip: 'drum'
};
function KnowledgePage({
  d,
  A,
  go
}) {
  const [tab, setTab] = React.useState('band');
  const [editId, setEditId] = React.useState(null);
  const [editText, setEditText] = React.useState('');
  const [menuId, setMenuId] = React.useState(null);
  const [originId, setOriginId] = React.useState(null);
  const [undo, setUndo] = React.useState(null);
  const [logOpen, setLogOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const rows = d.knowledge.filter(k => k.cat === tab && k.status !== 'retired');
  const icon = k => k.factId === 'budget' ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20
    }
  }, "\u20AC") : /*#__PURE__*/React.createElement(SIc, {
    name: KICON[k.factId] || (k.cat === 'band' ? 'music' : k.cat === 'ausstattung' ? 'drum' : 'home'),
    size: 22,
    strokeWidth: 1.5
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(H1, null, "Was ich \xFCber euch wei\xDF"), /*#__PURE__*/React.createElement(Lead, null, "Korrigiere mich jederzeit. Ihr bestimmt, was ich mir merke."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 26,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 20,
      padding: '20px 24px',
      borderRadius: 16,
      border: '1px solid var(--rs-border-panel)',
      background: 'rgba(255,255,255,.03)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      lineHeight: 1.45
    }
  }, d.summary), /*#__PURE__*/React.createElement(SIcBtn, {
    variant: "bare",
    size: 40,
    label: "Zugrunde liegende Angaben bearbeiten",
    onClick: () => setTab('band')
  }, /*#__PURE__*/React.createElement(SIc, {
    name: "edit",
    size: 20
  }))), /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      marginTop: 22,
      display: 'flex',
      gap: 6,
      borderBottom: '1px solid var(--rs-border-divider)'
    }
  }, Object.entries(CATS).map(([k, l]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    role: "tab",
    "aria-selected": tab === k,
    onClick: () => setTab(k),
    style: {
      height: 44,
      padding: '0 20px',
      border: 0,
      background: 'none',
      color: tab === k ? 'var(--rs-ink)' : 'var(--rs-ink-6)',
      fontFamily: 'inherit',
      fontSize: 17,
      cursor: 'pointer',
      borderBottom: `2px solid ${tab === k ? 'var(--rs-orange)' : 'transparent'}`,
      marginBottom: -1
    }
  }, l))), /*#__PURE__*/React.createElement(SOvl, {
    style: {
      marginTop: 22
    }
  }, CATS[tab]), !rows.length && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      padding: '22px 24px',
      borderRadius: 16,
      background: 'rgba(255,255,255,.03)',
      border: '1px solid var(--rs-border-card-soft)',
      fontSize: 17,
      color: 'var(--rs-ink-2)'
    }
  }, "Dazu wei\xDF ich noch nichts. Erz\xE4hl es mir im Gespr\xE4ch."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, rows.map(k => /*#__PURE__*/React.createElement("div", {
    key: k.id,
    style: {
      display: 'grid',
      gridTemplateColumns: '44px minmax(0,1fr) auto',
      gap: 14,
      alignItems: 'center',
      padding: '14px 8px',
      borderBottom: '1px solid var(--rs-border-divider)',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 26,
      height: 26,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--rs-ink-2)'
    }
  }, icon(k)), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, editId === k.id ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      A.updateKnowledge(k.id, editText.trim());
      setEditId(null);
    },
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: editText,
    onChange: e => setEditText(e.target.value),
    "aria-label": "Angabe bearbeiten",
    autoFocus: true,
    style: {
      flex: 1,
      minWidth: 220,
      height: 42,
      padding: '0 12px',
      borderRadius: 10,
      border: '1px solid rgba(255,200,160,.3)',
      background: 'var(--rs-surface-inset)',
      color: 'var(--rs-ink)',
      fontFamily: 'inherit',
      fontSize: 16
    }
  }), /*#__PURE__*/React.createElement(SBtn, {
    type: "submit",
    size: "2xs",
    style: {
      height: 42,
      fontSize: 14
    }
  }, "Speichern"), /*#__PURE__*/React.createElement(SBtn, {
    type: "button",
    variant: "secondary",
    size: "2xs",
    style: {
      height: 42,
      fontSize: 14
    },
    onClick: () => setEditId(null)
  }, "Abbrechen")), k.factId && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 13,
      color: 'var(--rs-ink-6)'
    }
  }, "Diese Angabe ist Teil eures Suchauftrags und wird dort ebenfalls aktualisiert.")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17
    }
  }, k.text), k.status === 'assumed' ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      marginTop: 6,
      padding: '3px 10px',
      borderRadius: 999,
      border: '1px solid var(--rs-border-accent)',
      background: 'var(--rs-surface-accent-tint-soft)',
      fontSize: 13,
      color: 'var(--rs-orange-tint)'
    }
  }, "Noch zu best\xE4tigen") : /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 2,
      fontSize: 13.5,
      color: 'var(--rs-ink-6)'
    }
  }, k.origin), originId === k.id && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 13.5,
      color: 'var(--rs-ink-4)',
      animation: 'rsFadeUp .2s ease both'
    }
  }, "Herkunft: ", k.origin, ". Verwendet f\xFCr: ", k.factId ? 'Suche und Anfragen' : 'Einordnung von Anzeigen', "."))), k.status === 'assumed' ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(SBtn, {
    variant: "link",
    size: "2xs",
    style: {
      color: 'var(--rs-ink)',
      fontSize: 15
    },
    onClick: () => A.updateKnowledgeStatus(k.id, 'confirmed')
  }, "Stimmt"), /*#__PURE__*/React.createElement(SBtn, {
    variant: "ghost",
    size: "2xs",
    style: {
      fontSize: 15
    },
    onClick: () => A.updateKnowledgeStatus(k.id, 'retired')
  }, "Nicht wichtig")) : editId !== k.id && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      alignItems: 'center',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(SIcBtn, {
    variant: "bare",
    size: 40,
    label: "Bearbeiten",
    onClick: () => {
      setEditId(k.id);
      setEditText(k.text);
      setMenuId(null);
    }
  }, /*#__PURE__*/React.createElement(SIc, {
    name: "edit",
    size: 18
  })), /*#__PURE__*/React.createElement(SIcBtn, {
    variant: "bare",
    size: 40,
    label: "Mehr",
    "aria-expanded": menuId === k.id,
    onClick: () => setMenuId(m => m === k.id ? null : k.id)
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "18",
    height: "18",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "6",
    cy: "12",
    r: "1.7"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "1.7"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "18",
    cy: "12",
    r: "1.7"
  }))), menuId === k.id && /*#__PURE__*/React.createElement("div", {
    role: "menu",
    style: {
      position: 'absolute',
      right: 0,
      top: 44,
      zIndex: 5,
      minWidth: 210,
      padding: 6,
      borderRadius: 12,
      background: 'rgba(20,15,12,.97)',
      border: '1px solid var(--rs-border-panel)',
      boxShadow: 'var(--shadow-toast)',
      display: 'flex',
      flexDirection: 'column',
      animation: 'rsFadeUp .15s ease both'
    }
  }, /*#__PURE__*/React.createElement(SBtn, {
    variant: "ghost",
    size: "2xs",
    style: {
      justifyContent: 'flex-start',
      color: 'var(--rs-ink)',
      fontSize: 14.5,
      padding: '9px 12px'
    },
    onClick: () => {
      A.updateKnowledgeStatus(k.id, 'retired');
      setUndo(k);
      setMenuId(null);
    }
  }, "Nicht mehr verwenden"), /*#__PURE__*/React.createElement(SBtn, {
    variant: "ghost",
    size: "2xs",
    style: {
      justifyContent: 'flex-start',
      color: 'var(--rs-ink)',
      fontSize: 14.5,
      padding: '9px 12px'
    },
    onClick: () => {
      setOriginId(o => o === k.id ? null : k.id);
      setMenuId(null);
    }
  }, "Herkunft ansehen")))))), undo && /*#__PURE__*/React.createElement("div", {
    role: "status",
    style: {
      marginTop: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      padding: '12px 16px',
      borderRadius: 12,
      background: 'rgba(255,255,255,.05)',
      border: '1px solid var(--rs-border-card)',
      fontSize: 14.5,
      animation: 'rsFadeUp .2s ease both'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u201E", undo.text, "\u201C wird nicht mehr verwendet."), /*#__PURE__*/React.createElement(SBtn, {
    variant: "ghost",
    size: "2xs",
    style: {
      color: 'var(--rs-orange-light)',
      fontWeight: 500,
      fontSize: 14.5
    },
    onClick: () => {
      A.updateKnowledgeStatus(undo.id, 'confirmed');
      setUndo(null);
    }
  }, "R\xFCckg\xE4ngig")), /*#__PURE__*/React.createElement(SBtn, {
    variant: "link",
    size: "2xs",
    style: {
      marginTop: 16,
      color: 'var(--rs-ink)',
      fontSize: 15,
      padding: '6px 0'
    },
    onClick: () => setLogOpen(o => !o)
  }, logOpen ? 'Änderungen ausblenden' : 'Änderungen ansehen'), logOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      padding: '14px 20px',
      borderRadius: 14,
      background: 'rgba(255,255,255,.03)',
      border: '1px solid var(--rs-border-card-soft)',
      animation: 'rsFadeUp .2s ease both'
    }
  }, !d.knowledgeLog.length && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14.5,
      color: 'var(--rs-ink-6)',
      padding: '4px 0'
    }
  }, "Noch keine \xC4nderungen in dieser Demo."), d.knowledgeLog.map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 16,
      padding: '8px 0',
      borderBottom: '1px solid var(--rs-border-divider-soft)',
      fontSize: 14.5
    }
  }, /*#__PURE__*/React.createElement("span", null, l.text), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--rs-ink-6)',
      whiteSpace: 'nowrap'
    }
  }, l.when)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 26,
      paddingTop: 24,
      borderTop: '1px solid var(--rs-border-divider)',
      display: 'grid',
      gridTemplateColumns: 'auto minmax(0,1fr) auto',
      gap: 20,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "26",
    height: "26",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 4v11M7 10l5 5 5-5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 19h16"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18
    }
  }, "Dein bisheriger Kontext kann mitkommen"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4,
      fontSize: 14.5,
      color: 'var(--rs-ink-4)'
    }
  }, "Musik-Kontext aus ChatGPT oder Claude \xFCbernehmen.")), /*#__PURE__*/React.createElement(SqBtn, {
    onClick: () => setImportOpen(true)
  }, "Kontext importieren")), /*#__PURE__*/React.createElement(SBtn, {
    variant: "link",
    size: "2xs",
    style: {
      marginTop: 22,
      color: 'var(--rs-ink)',
      fontSize: 15,
      padding: '6px 0'
    },
    onClick: () => go('privacy')
  }, "Gespeicherte Informationen verwalten"), importOpen && /*#__PURE__*/React.createElement(ImportDialog, {
    close: () => setImportOpen(false),
    apply: items => {
      A.addKnowledge(items);
      setImportOpen(false);
    }
  }));
}
const IMPORT_PROMPT = 'Fasse ausschließlich den musikbezogenen Kontext zusammen, den du tatsächlich über mich und meine Band kennst: Besetzung, Instrumente, Musikrichtung, Proberaumwünsche, Budget, Verfügbarkeit und relevante Wege. Erfinde nichts, kennzeichne Unsicheres und lasse Passwörter, Kontaktdaten und sachfremde persönliche Informationen weg. Falls dir kein solcher Kontext vorliegt, sage das ausdrücklich.';
const EXAMPLE = 'Wir sind eine fünfköpfige Band aus Stuttgart (zwei Gitarren, Bass, Schlagzeug, Gesang) und spielen Hardrock und Alternative. Wir proben meist abends nach 19 Uhr und kommen mit dem Auto, ein Parkplatz wäre hilfreich. Beim Budget bin ich unsicher, vermutlich bis 300 € im Monat.';
const IMPORT_CANDS = [{
  id: 'i1',
  cat: 'band',
  text: 'Fünfköpfige Besetzung: zwei Gitarren, Bass, Schlagzeug, Gesang',
  conflict: 'Widerspricht „Geteilter Raum · 4 Personen“ aus dem Gespräch.'
}, {
  id: 'i2',
  cat: 'band',
  text: 'Hardrock und Alternative'
}, {
  id: 'i3',
  cat: 'alltag',
  text: 'Anreise mit dem Auto, Parkplatz hilfreich'
}, {
  id: 'i4',
  cat: 'alltag',
  text: 'Proben meist abends nach 19 Uhr'
}, {
  id: 'i5',
  cat: 'band',
  text: 'Budget unsicher, vermutlich bis 300 €',
  conflict: 'Euer Suchauftrag sagt bis 350 €. Bleibt unverändert.'
}];
function ImportDialog({
  close,
  apply
}) {
  const [step, setStep] = React.useState(1);
  const [text, setText] = React.useState('');
  const [free, setFree] = React.useState(false);
  const [picks, setPicks] = React.useState({
    i2: true,
    i3: true,
    i4: true
  });
  const [copied, setCopied] = React.useState(false);
  const n = Object.values(picks).filter(Boolean).length;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: close,
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 20,
      background: 'rgba(6,4,3,.6)',
      animation: 'rsFadeUp .2s ease both'
    }
  }), /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    style: {
      position: 'absolute',
      zIndex: 21,
      left: '50%',
      top: '50%',
      transform: 'translate(-50%,-50%)',
      width: 'min(640px,calc(100% - 48px))',
      maxHeight: 'calc(100% - 48px)',
      overflow: 'auto',
      background: 'rgba(18,14,11,.98)',
      border: '1px solid var(--rs-border-panel)',
      borderRadius: 22,
      padding: '30px 32px',
      boxShadow: '0 30px 80px rgba(0,0,0,.5)',
      animation: 'rsFadeUp .25s ease both'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SOvl, null, "Schritt ", step, " von 3"), /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: '6px 0 0',
      fontSize: 24,
      fontWeight: 500
    }
  }, ['Prompt kopieren', 'Kontext einfügen', 'Angaben prüfen'][step - 1])), /*#__PURE__*/React.createElement(SIcBtn, {
    variant: "subtle",
    size: 40,
    label: "Schlie\xDFen",
    onClick: close
  }, /*#__PURE__*/React.createElement(SIc, {
    name: "close",
    size: 18
  }))), step === 1 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      fontSize: 15,
      color: 'var(--rs-ink-4)'
    }
  }, "Kopiere diesen Prompt in ChatGPT oder Claude und lass dir den musikbezogenen Kontext zusammenfassen."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      padding: '16px 18px',
      borderRadius: 14,
      background: 'var(--rs-surface-subtle)',
      border: '1px solid var(--rs-border-card)',
      fontSize: 14.5,
      lineHeight: 1.6,
      userSelect: 'all'
    }
  }, IMPORT_PROMPT), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      display: 'flex',
      justifyContent: 'space-between',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(SqBtn, {
    onClick: () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    },
    style: {
      minWidth: 150
    }
  }, copied ? 'Kopiert' : 'Prompt kopieren'), /*#__PURE__*/React.createElement(SqBtn, {
    primary: true,
    onClick: () => setStep(2)
  }, "Weiter"))), step === 2 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      marginTop: 18,
      fontSize: 14,
      color: 'var(--rs-ink-6)'
    }
  }, "Musik-Kontext einf\xFCgen"), /*#__PURE__*/React.createElement("textarea", {
    value: text,
    onChange: e => setText(e.target.value),
    rows: 6,
    placeholder: "Zusammenfassung hier einf\xFCgen \u2026",
    style: {
      marginTop: 6,
      width: '100%',
      padding: '14px 16px',
      borderRadius: 14,
      border: '1px solid rgba(255,220,190,.2)',
      background: 'var(--rs-surface-inset)',
      color: 'var(--rs-ink)',
      fontFamily: 'inherit',
      fontSize: 15,
      lineHeight: 1.55,
      resize: 'vertical'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      fontSize: 13.5,
      color: 'var(--rs-ink-6)'
    }
  }, "Bitte keine Zugangsdaten oder sensiblen Informationen einf\xFCgen. Der Text wird nach dem Import nicht gespeichert."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      display: 'flex',
      justifyContent: 'space-between',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(SqBtn, {
    onClick: () => setText(EXAMPLE)
  }, "Beispiel einsetzen"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(SqBtn, {
    onClick: () => setStep(1)
  }, "Zur\xFCck"), /*#__PURE__*/React.createElement(SqBtn, {
    primary: true,
    disabled: !text.trim(),
    onClick: () => {
      setFree(text.trim() !== EXAMPLE);
      setStep(3);
    }
  }, "Angaben pr\xFCfen")))), step === 3 && (free ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      padding: '16px 18px',
      borderRadius: 14,
      background: 'var(--rs-surface-subtle)',
      border: '1px solid var(--rs-border-card)',
      fontSize: 15,
      lineHeight: 1.55,
      color: 'var(--rs-ink-2)'
    }
  }, "Freitext wird in diesem Prototyp nicht automatisch ausgewertet. F\xFCr die Demo steht das vorbereitete Beispiel bereit; eigene Angaben kannst du im Gespr\xE4ch oder direkt in der Wissensliste erg\xE4nzen."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(SqBtn, {
    onClick: () => setStep(2)
  }, "Zur\xFCck"), /*#__PURE__*/React.createElement(SqBtn, {
    primary: true,
    onClick: () => {
      setText(EXAMPLE);
      setFree(false);
    }
  }, "Beispiel verwenden"))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      fontSize: 15,
      color: 'var(--rs-ink-4)'
    }
  }, "Simulierte Auswertung des Beispiels. W\xE4hle, was dein Scout sich merken soll."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, IMPORT_CANDS.map(c => /*#__PURE__*/React.createElement("label", {
    key: c.id,
    style: {
      display: 'grid',
      gridTemplateColumns: 'auto minmax(0,1fr)',
      gap: 14,
      alignItems: 'start',
      padding: '12px 6px',
      borderBottom: '1px solid var(--rs-border-divider-soft)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!picks[c.id],
    onChange: e => setPicks(p => ({
      ...p,
      [c.id]: e.target.checked
    })),
    style: {
      marginTop: 4,
      width: 18,
      height: 18,
      accentColor: '#ff6926'
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16
    }
  }, c.text), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--rs-ink-6)',
      marginTop: 2
    }
  }, CATS[c.cat]), c.conflict && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      display: 'flex',
      gap: 8,
      alignItems: 'flex-start',
      fontSize: 13.5,
      color: 'var(--rs-amber)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      marginTop: 6,
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: 'var(--rs-amber)',
      flex: 'none'
    }
  }), c.conflict))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      display: 'flex',
      justifyContent: 'space-between',
      gap: 10,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--rs-ink-6)'
    }
  }, n, " ausgew\xE4hlt"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(SqBtn, {
    onClick: () => setStep(2)
  }, "Zur\xFCck"), /*#__PURE__*/React.createElement(SqBtn, {
    primary: true,
    disabled: !n,
    onClick: () => apply(IMPORT_CANDS.filter(c => picks[c.id]).map(c => ({
      id: 'imp_' + c.id,
      cat: c.cat,
      text: c.text,
      origin: 'Aus importiertem Kontext',
      status: 'confirmed'
    })))
  }, "Ausgew\xE4hlte Angaben \xFCbernehmen")))))));
}
function ProfilePage({
  d,
  A
}) {
  const [draft, setDraft] = React.useState(d.name);
  const [saved, setSaved] = React.useState(false);
  const ini = draft.trim() === 'Herzbuben' ? 'HB' : draft.trim().split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'HB';
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(H1, null, "Dein Profil"), /*#__PURE__*/React.createElement(Lead, null, "Wie soll dein Scout euch ansprechen?"), /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      A.setName(draft.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    },
    style: {
      marginTop: 28,
      display: 'grid',
      gridTemplateColumns: 'auto minmax(0,1fr)',
      gap: 24,
      alignItems: 'center',
      paddingBottom: 26,
      borderBottom: '1px solid var(--rs-border-divider)'
    }
  }, /*#__PURE__*/React.createElement(SAvatar, {
    size: 72,
    initials: ini
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 13,
      color: 'var(--rs-ink-6)',
      marginBottom: 6
    }
  }, "Anzeigename"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: draft,
    onChange: e => setDraft(e.target.value),
    "aria-label": "Anzeigename",
    style: {
      flex: 1,
      minWidth: 220,
      height: 48,
      padding: '0 16px',
      borderRadius: 12,
      border: '1px solid rgba(255,220,190,.2)',
      background: 'var(--rs-surface-inset)',
      color: 'var(--rs-ink)',
      fontFamily: 'inherit',
      fontSize: 17
    }
  }), /*#__PURE__*/React.createElement(SqBtn, {
    primary: true,
    disabled: !draft.trim() || draft.trim() === d.name,
    style: {
      height: 48
    }
  }, "Speichern")), saved && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      fontSize: 14,
      color: 'var(--rs-ink-4)',
      animation: 'rsFadeUp .2s ease both'
    }
  }, "Name gespeichert. Ansprache und Initialen sind aktualisiert."))), /*#__PURE__*/React.createElement(Row, {
    style: {
      padding: '22px 0'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17
    }
  }, "Demo-Login"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 3,
      fontSize: 14.5,
      color: 'var(--rs-ink-4)'
    }
  }, "Lokale Beispielidentit\xE4t \u201Eherzbuben\u201C \xB7 keine echte Anmeldung")), /*#__PURE__*/React.createElement(SBadge, {
    variant: "muted",
    style: {
      fontSize: 13.5,
      padding: '5px 12px'
    }
  }, "Designprototyp")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '22px 0',
      fontSize: 14.5,
      color: 'var(--rs-ink-4)',
      lineHeight: 1.6
    }
  }, "Externe Portal-Accounts und deine Scout-Adresse werden bei einer Namens\xE4nderung nicht umbenannt."));
}
function NotifPage({
  d,
  A
}) {
  const n = d.notif;
  const set = p => A.setNotif({
    ...n,
    ...p
  });
  const rows = [['decision', 'Wenn eine Entscheidung nötig ist', 'Rückfragen des Anbieters, Terminabweichungen'], ['offer', 'Wenn ein Angebot eingeht', 'Konkrete Konditionen zum Prüfen'], ['digest', 'Tägliche Zusammenfassung', 'Was der Scout heute erledigt hat']];
  const Seg = ({
    v,
    label
  }) => /*#__PURE__*/React.createElement("button", {
    role: "radio",
    "aria-checked": n.channel === v,
    onClick: () => set({
      channel: v
    }),
    style: {
      height: 40,
      padding: '0 18px',
      borderRadius: 9,
      border: 0,
      background: n.channel === v ? 'rgba(255,255,255,.1)' : 'transparent',
      color: 'var(--rs-ink)',
      fontFamily: 'inherit',
      fontSize: 15,
      cursor: 'pointer',
      transition: 'background .15s'
    }
  }, label);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(H1, null, "Wann soll ich mich melden?"), /*#__PURE__*/React.createElement(Lead, null, "Wichtiges erreicht dich immer in der App."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 26
    }
  }, rows.map(([k, l, s]) => /*#__PURE__*/React.createElement(Row, {
    key: k
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17
    }
  }, l), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 2,
      fontSize: 14,
      color: 'var(--rs-ink-6)'
    }
  }, s)), /*#__PURE__*/React.createElement(SSw, {
    checked: !!n[k],
    onChange: v => set({
      [k]: v
    }),
    label: l
  })))), /*#__PURE__*/React.createElement(SOvl, {
    style: {
      marginTop: 28
    }
  }, "Kanal"), /*#__PURE__*/React.createElement("div", {
    role: "radiogroup",
    style: {
      marginTop: 12,
      display: 'inline-flex',
      padding: 4,
      borderRadius: 12,
      border: '1px solid var(--rs-border-panel)',
      background: 'rgba(0,0,0,.2)'
    }
  }, /*#__PURE__*/React.createElement(Seg, {
    v: "app",
    label: "In der App"
  }), /*#__PURE__*/React.createElement(Seg, {
    v: "mail",
    label: "Scout-Adresse (simuliert)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      fontSize: 14.5,
      color: 'var(--rs-ink-4)',
      lineHeight: 1.6
    }
  }, "Pr\xE4ferenzen werden lokal gespeichert. Es wird keine Browser-Berechtigung angefragt und keine echte E-Mail versendet. Notwendige Entscheidungen bleiben in der App sichtbar, auch wenn Benachrichtigungen aus sind."));
}
function BillingPage({
  d
}) {
  const [tariff, setTariff] = React.useState(false);
  const [pay, setPay] = React.useState(false);
  const Info = ({
    children
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      padding: '18px 22px',
      borderRadius: 14,
      background: 'rgba(255,255,255,.03)',
      border: '1px solid var(--rs-border-card-soft)',
      animation: 'rsFadeUp .2s ease both'
    }
  }, children);
  const LineItem = ({
    icon,
    t,
    s,
    btn,
    onClick
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'auto minmax(0,1fr) auto',
      gap: 20,
      alignItems: 'center',
      padding: '20px 0',
      borderBottom: '1px solid var(--rs-border-divider)'
    }
  }, /*#__PURE__*/React.createElement(SIc, {
    name: icon,
    size: 26,
    strokeWidth: 1.5
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 2,
      fontSize: 14.5,
      color: 'var(--rs-ink-4)'
    }
  }, s)), btn && /*#__PURE__*/React.createElement(SqBtn, {
    onClick: onClick,
    style: {
      height: 44,
      padding: '0 20px'
    }
  }, btn));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(H1, null, "Tarif & Nutzung"), /*#__PURE__*/React.createElement(Lead, null, "Dein Zugang, deine Aktivit\xE4t und deine Abrechnung."), /*#__PURE__*/React.createElement(SOvl, {
    style: {
      marginTop: 26,
      paddingTop: 22,
      borderTop: '1px solid var(--rs-border-divider)'
    }
  }, "Dein Zugang"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 20,
      paddingBottom: 22,
      borderBottom: '1px solid var(--rs-border-divider)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22
    }
  }, "Demo-Zugang"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4,
      fontSize: 15,
      color: 'var(--rs-ink-4)'
    }
  }, "Kein kostenpflichtiges Abonnement aktiv.")), /*#__PURE__*/React.createElement(SqBtn, {
    onClick: () => setTariff(t => !t)
  }, "Tarife ansehen")), tariff && /*#__PURE__*/React.createElement(Info, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17
    }
  }, "Tarife sind noch nicht festgelegt."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4,
      fontSize: 14.5,
      color: 'var(--rs-ink-4)'
    }
  }, "In diesem Prototyp kannst du RoomScout ausprobieren. Es wird nichts berechnet.")), /*#__PURE__*/React.createElement(SOvl, {
    style: {
      marginTop: 24
    }
  }, "Aktivit\xE4t im September"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      display: 'grid',
      gridTemplateColumns: 'repeat(3,minmax(0,1fr))'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '6px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 40,
      fontWeight: 500,
      letterSpacing: '-.02em'
    }
  }, d.usage.searches), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 2,
      fontSize: 16,
      color: 'var(--rs-ink-4)'
    }
  }, d.usage.searches === 1 ? 'Suchauftrag' : 'Suchaufträge')), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '6px 0 6px 28px',
      borderLeft: '1px solid rgba(255,220,190,.12)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 40,
      fontWeight: 500,
      letterSpacing: '-.02em'
    }
  }, d.usage.contacted), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 2,
      fontSize: 16,
      color: 'var(--rs-ink-4)'
    }
  }, "Anbieter kontaktiert")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '6px 0 6px 28px',
      borderLeft: '1px solid rgba(255,220,190,.12)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      paddingTop: 12,
      color: 'var(--rs-ink-2)'
    }
  }, "Noch nicht erfasst"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 16,
      color: 'var(--rs-ink-4)'
    }
  }, "Gespr\xE4che mit Scout"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      fontSize: 14,
      color: 'var(--rs-ink-6)',
      paddingBottom: 22,
      borderBottom: '1px solid var(--rs-border-divider)'
    }
  }, "Aktivit\xE4ts\xFCbersicht, keine Abrechnungseinheiten."), /*#__PURE__*/React.createElement(LineItem, {
    icon: "card",
    t: "Zahlungsdaten",
    s: "Keine Zahlungsmethode hinterlegt",
    btn: "Verwalten",
    onClick: () => setPay(p => !p)
  }), /*#__PURE__*/React.createElement(LineItem, {
    icon: "home",
    t: "Rechnungsadresse",
    s: "Noch nicht hinterlegt",
    btn: "Hinzuf\xFCgen",
    onClick: () => setPay(p => !p)
  }), pay && /*#__PURE__*/React.createElement(Info, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17
    }
  }, "Zahlungsverwaltung ist noch nicht eingerichtet."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4,
      fontSize: 14.5,
      color: 'var(--rs-ink-4)'
    }
  }, "Hier w\xFCrdest du sp\xE4ter deine Zahlungs- und Rechnungsdaten verwalten.")), /*#__PURE__*/React.createElement(SOvl, {
    style: {
      marginTop: 24
    }
  }, "Rechnungen"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      display: 'grid',
      gridTemplateColumns: 'auto minmax(0,1fr)',
      gap: 20,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(SIc, {
    name: "doc",
    size: 26,
    strokeWidth: 1.5
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17
    }
  }, "Noch keine Rechnungen"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 2,
      fontSize: 14.5,
      color: 'var(--rs-ink-4)'
    }
  }, "Hier findest du sp\xE4ter deine Belege."))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 28,
      textAlign: 'right',
      fontSize: 14,
      color: 'var(--rs-ink-6)'
    }
  }, "Produktkonzept \xB7 Noch keine Zahlungsintegration"));
}
function PrivacyPage({
  d,
  go,
  showToast
}) {
  const Item = ({
    t,
    s,
    btn,
    onClick,
    first
  }) => /*#__PURE__*/React.createElement(Row, {
    style: {
      padding: '18px 0',
      borderTop: first ? '1px solid var(--rs-border-divider)' : 0
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 2,
      fontSize: 14.5,
      color: 'var(--rs-ink-4)',
      lineHeight: 1.6
    }
  }, s)), btn && /*#__PURE__*/React.createElement(SqBtn, {
    onClick: onClick,
    style: {
      height: 42,
      padding: '0 18px',
      fontSize: 14.5
    }
  }, btn));
  const connected = d.sources.filter(s => s.kind === 'portal' && s.access === 'connected').length;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(H1, null, "Deine Daten, deine Kontrolle"), /*#__PURE__*/React.createElement(Lead, null, "Was RoomScout in dieser Demo lokal speichert."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 26
    }
  }, /*#__PURE__*/React.createElement(Item, {
    first: true,
    t: "Gespeicherte Angaben",
    s: d.knowledge.filter(k => k.status !== 'retired').length + ' Angaben über eure Band und Suche',
    btn: "Gespeicherte Angaben ansehen",
    onClick: () => go('knowledge')
  }), /*#__PURE__*/React.createElement(Item, {
    t: "Gespr\xE4chsverlauf",
    s: "Mitschrift eurer Gespr\xE4che mit dem Scout, in der App einsehbar"
  }), /*#__PURE__*/React.createElement(Item, {
    t: "Portalzug\xE4nge",
    s: connected + (connected === 1 ? ' verbundener Portalzugang, simuliert' : ' verbundene Portalzugänge, simuliert'),
    btn: "Portalzug\xE4nge verwalten",
    onClick: () => go('sources')
  }), /*#__PURE__*/React.createElement(Item, {
    t: "Export",
    s: "Exportiert ausschlie\xDFlich die lokalen Demo-Daten dieses Prototyps als JSON.",
    btn: "Demo-Daten exportieren",
    onClick: () => showToast('Demo-Daten als JSON exportiert (simuliert).')
  }), /*#__PURE__*/React.createElement(Item, {
    t: "Konto l\xF6schen",
    s: "Im sp\xE4teren Produkt w\xFCrde hier die endg\xFCltige L\xF6schung aller Kontodaten angesto\xDFen. In dieser Demo gibt es daf\xFCr noch keine Funktion; der Demo-Neustart ersetzt sie nicht."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17
    }
  }, "Beteiligte Dienstleister"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 2,
      fontSize: 14.5,
      color: 'var(--rs-ink-4)',
      lineHeight: 1.6
    }
  }, "F\xFCr Text und Auswertung, Quellenbeobachtung, Scout-Postf\xE4cher, Portal-Zug\xE4nge sowie Sprache: Convex, Firecrawl, AgentMail, Browserbase und OpenAI. Welche Daten dabei verarbeitet werden, h\xE4ngt von der konkreten Funktion ab und w\xE4re im Produkt einzeln erkl\xE4rt."))));
}

/* Right-hand sheet: portal connection (info · confirm disconnect · login simulation). */
function ConnSheet({
  d,
  A,
  close
}) {
  const src = d.sources.find(s => s.id === 'roomscout');
  const [mode, setMode] = React.useState('info');
  const [msg, setMsg] = React.useState(null);
  const ok = src.access === 'connected';
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: close,
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 20,
      background: 'rgba(6,4,3,.55)',
      animation: 'rsFadeUp .2s ease both'
    }
  }), /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    style: {
      position: 'absolute',
      zIndex: 21,
      top: 0,
      right: 0,
      bottom: 0,
      width: 'min(480px,100%)',
      background: 'rgba(18,14,11,.98)',
      borderLeft: '1px solid var(--rs-border-panel)',
      padding: '34px 34px 30px',
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column',
      animation: 'rsFadeUp .25s ease both'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 26,
      fontWeight: 500,
      letterSpacing: '-.01em'
    }
  }, "Verbindung zu roomscout.dev"), /*#__PURE__*/React.createElement(SIcBtn, {
    variant: "subtle",
    size: 40,
    label: "Schlie\xDFen",
    onClick: close
  }, /*#__PURE__*/React.createElement(SIc, {
    name: "close",
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 26,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      fontSize: 16,
      lineHeight: 1.5
    }
  }, [['Portalprofil', 'Herzbuben'], ['Zustand', /*#__PURE__*/React.createElement(SDot, {
    tone: ok ? 'success' : 'warning',
    style: {
      fontSize: 16,
      color: 'var(--rs-ink)'
    }
  }, ok ? 'Verbunden' : 'Anmeldung abgelaufen')], ['Letzter erfolgreicher Zugriff', src.lastAccess || 'Heute · Demo-Lauf']].map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 16,
      paddingBottom: 12,
      borderBottom: '1px solid var(--rs-border-divider)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--rs-ink-6)'
    }
  }, k), /*#__PURE__*/React.createElement("span", null, v))), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--rs-ink-4)',
      fontSize: 15
    }
  }, ok ? 'Dein Scout kann Anzeigen lesen und private Nachrichten im Portal austauschen.' : 'Ohne gültige Anmeldung kann dein Scout keine privaten Portalnachrichten lesen oder senden.')), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), ok && mode === 'info' && /*#__PURE__*/React.createElement(SqBtn, {
    onClick: () => setMode('confirm'),
    style: {
      marginTop: 24,
      height: 48
    }
  }, "Verbindung trennen"), mode === 'confirm' && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      padding: '18px 20px',
      borderRadius: 14,
      background: 'var(--rs-surface-subtle)',
      border: '1px solid var(--rs-border-panel)',
      animation: 'rsFadeUp .2s ease both'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15.5,
      lineHeight: 1.5
    }
  }, "RoomScout verliert den gespeicherten Zugang. Dein Account auf dem Portal bleibt bestehen."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      display: 'flex',
      gap: 10,
      justifyContent: 'flex-end',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(SqBtn, {
    onClick: () => setMode('info'),
    style: {
      height: 44
    }
  }, "Verbunden bleiben"), /*#__PURE__*/React.createElement(SqBtn, {
    danger: true,
    onClick: () => {
      A.setAccess('roomscout', 'disconnected');
      setMode('info');
      setMsg('Verbindung getrennt.');
    },
    style: {
      height: 44
    }
  }, "Verbindung trennen"))), !ok && mode === 'info' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      fontSize: 15,
      color: 'var(--rs-ink-2)'
    }
  }, "Zum Lesen oder Senden privater Nachrichten musst du dich verbinden."), /*#__PURE__*/React.createElement(SqBtn, {
    primary: true,
    onClick: () => setMode('login'),
    style: {
      marginTop: 14,
      height: 48
    }
  }, "Anmeldung \xF6ffnen")), mode === 'login' && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      padding: 20,
      borderRadius: 14,
      background: 'var(--rs-surface-subtle)',
      border: '1px dashed rgba(255,200,160,.35)',
      animation: 'rsFadeUp .2s ease both'
    }
  }, /*#__PURE__*/React.createElement(SOvl, {
    tone: "accent"
  }, "Demo-Anmeldesimulation"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      fontSize: 15,
      lineHeight: 1.55,
      color: 'var(--rs-ink-2)'
    }
  }, "Dies ist keine echte Login-Seite von roomscout.dev. Es werden keine Zugangsdaten abgefragt oder gespeichert. Die Anmeldung wird lokal simuliert."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      display: 'flex',
      gap: 10,
      justifyContent: 'flex-end',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(SqBtn, {
    onClick: () => setMode('info'),
    style: {
      height: 44
    }
  }, "Abbrechen"), /*#__PURE__*/React.createElement(SqBtn, {
    primary: true,
    onClick: () => {
      A.setAccess('roomscout', 'connected');
      setMode('info');
      setMsg('Verbunden. Dein Scout kann wieder Nachrichten lesen.');
    },
    style: {
      height: 44
    }
  }, "Demo-Anmeldung abschlie\xDFen"))), msg && /*#__PURE__*/React.createElement("div", {
    role: "status",
    style: {
      marginTop: 14,
      fontSize: 14.5,
      color: 'var(--rs-ink-4)',
      animation: 'rsFadeUp .2s ease both'
    }
  }, msg)));
}
function Settings({
  d,
  A,
  page,
  setPage,
  back,
  session
}) {
  const [sheet, setSheet] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const showToast = t => {
    setToast(t);
    setTimeout(() => setToast(null), 2200);
  };
  const nav = [['sources', 'globe', 'Quellen & Zugänge'], ['autonomy', 'sliders', 'Handlungsspielraum'], ['knowledge', 'doc', 'Was dein Scout weiß']];
  const acct = [['profile', 'user', 'Profil'], ['notifications', 'bell', 'Benachrichtigungen'], ['billing', 'card', 'Tarif & Nutzung'], ['privacy', 'shield', 'Datenschutz']];
  const P = {
    sources: /*#__PURE__*/React.createElement(SourcesPage, {
      d: d,
      A: A,
      setSheet: setSheet
    }),
    autonomy: /*#__PURE__*/React.createElement(AutonomyPage, {
      d: d,
      A: A
    }),
    knowledge: /*#__PURE__*/React.createElement(KnowledgePage, {
      d: d,
      A: A,
      go: setPage
    }),
    profile: /*#__PURE__*/React.createElement(ProfilePage, {
      d: d,
      A: A
    }),
    notifications: /*#__PURE__*/React.createElement(NotifPage, {
      d: d,
      A: A
    }),
    billing: /*#__PURE__*/React.createElement(BillingPage, {
      d: d
    }),
    privacy: /*#__PURE__*/React.createElement(PrivacyPage, {
      d: d,
      go: setPage,
      showToast: showToast
    })
  }[page];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 2,
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      padding: '4px 36px 0',
      animation: 'rsFadeUp .35s ease both'
    }
  }, /*#__PURE__*/React.createElement(SCard, {
    tone: "panel",
    size: "panel",
    padding: 0,
    style: {
      flex: 1,
      minHeight: 0,
      maxWidth: 1380,
      width: '100%',
      margin: '0 auto',
      display: 'grid',
      gridTemplateColumns: '296px minmax(0,1fr)',
      overflow: 'hidden',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("nav", {
    style: {
      padding: '36px 26px 30px',
      borderRight: '1px solid var(--rs-border-divider-soft)',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      overflow: 'auto',
      scrollbarWidth: 'none'
    }
  }, /*#__PURE__*/React.createElement(SBtn, {
    variant: "ghost",
    icon: /*#__PURE__*/React.createElement(SIc, {
      name: "arrow-left",
      size: 20
    }),
    style: {
      color: 'var(--rs-ink)',
      fontSize: 16,
      padding: '8px 10px',
      justifyContent: 'flex-start',
      gap: 12
    },
    onClick: back
  }, "Zur\xFCck zum Scout"), session && /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '14px 10px 0',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 9,
      fontSize: 12.5,
      lineHeight: 1.4,
      color: 'var(--rs-ink-4)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      marginTop: 5,
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: 'var(--rs-orange)',
      flex: 'none'
    }
  }), session), /*#__PURE__*/React.createElement(SGroup, {
    style: {
      margin: '34px 10px 10px'
    }
  }, "Dein Scout"), nav.map(([id, ic, l]) => /*#__PURE__*/React.createElement(SNav, {
    key: id,
    current: page === id,
    icon: /*#__PURE__*/React.createElement(SIc, {
      name: ic,
      size: 20
    }),
    onClick: () => setPage(id),
    style: {
      marginBottom: 4
    }
  }, l)), /*#__PURE__*/React.createElement(SGroup, null, "Dein Konto"), acct.map(([id, ic, l]) => /*#__PURE__*/React.createElement(SNav, {
    key: id,
    current: page === id,
    icon: /*#__PURE__*/React.createElement(SIc, {
      name: ic,
      size: 20
    }),
    onClick: () => setPage(id),
    style: {
      marginBottom: 4
    }
  }, l)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--rs-border-divider)',
      margin: '24px 0 20px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 500
    }
  }, d.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--rs-ink-6)',
      marginTop: 2
    }
  }, "Pers\xF6nlicher Bereich"))), /*#__PURE__*/React.createElement("section", {
    key: page,
    style: {
      minHeight: 0,
      overflow: 'auto',
      scrollbarWidth: 'thin',
      padding: '42px 46px 40px',
      animation: 'rsFadeUp .2s ease-out both'
    }
  }, P), sheet === 'conn' && /*#__PURE__*/React.createElement(ConnSheet, {
    d: d,
    A: A,
    close: () => setSheet(null)
  }), toast && /*#__PURE__*/React.createElement("div", {
    role: "status",
    style: {
      position: 'absolute',
      zIndex: 40,
      left: '50%',
      bottom: 22,
      transform: 'translateX(-50%)',
      padding: '10px 18px',
      borderRadius: 12,
      background: 'rgba(28,20,14,.96)',
      border: '1px solid rgba(255,200,160,.22)',
      fontSize: 14,
      whiteSpace: 'nowrap',
      animation: 'rsFadeUp .2s ease both'
    }
  }, toast)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      fontSize: 13,
      color: 'var(--rs-ink-6)',
      padding: '14px 0 12px'
    }
  }, "Designprototyp \xB7 Beispieldaten"));
}
Object.assign(window, {
  Settings
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/roomscout-app/Settings.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Capsule = __ds_scope.Capsule;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.ICON_NAMES = __ds_scope.ICON_NAMES;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.Overline = __ds_scope.Overline;

__ds_ns.ScoutBlob = __ds_scope.ScoutBlob;

__ds_ns.StatusDot = __ds_scope.StatusDot;

__ds_ns.SummaryPill = __ds_scope.SummaryPill;

__ds_ns.Wordmark = __ds_scope.Wordmark;

__ds_ns.DataTable = __ds_scope.DataTable;

__ds_ns.FactList = __ds_scope.FactList;

__ds_ns.ChatBubble = __ds_scope.ChatBubble;

__ds_ns.Hint = __ds_scope.Hint;

__ds_ns.Notice = __ds_scope.Notice;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Composer = __ds_scope.Composer;

__ds_ns.RadioCard = __ds_scope.RadioCard;

__ds_ns.Stepper = __ds_scope.Stepper;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.TextInput = __ds_scope.TextInput;

__ds_ns.VoiceControl = __ds_scope.VoiceControl;

__ds_ns.Accordion = __ds_scope.Accordion;

__ds_ns.AppHeader = __ds_scope.AppHeader;

__ds_ns.NavItem = __ds_scope.NavItem;

__ds_ns.NavGroupLabel = __ds_scope.NavGroupLabel;

__ds_ns.ProfileMenu = __ds_scope.ProfileMenu;

})();
