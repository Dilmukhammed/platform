import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        /* Primary Accent */
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          active: "var(--color-primary-active)",
          subtle: "var(--color-primary-subtle)",
        },

        /* Surface Layers */
        surface: {
          DEFAULT: "var(--color-surface)",
          raised: "var(--color-surface-raised)",
          muted: "var(--color-surface-muted)",
          elevated: "var(--color-surface-elevated)",
        },

        /* Text Colors */
        foreground: {
          DEFAULT: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
          inverse: "var(--color-text-inverse)",
        },

        /* Border Colors */
        border: {
          DEFAULT: "var(--color-border-default)",
          subtle: "var(--color-border-subtle)",
          focus: "var(--color-border-focus)",
          hover: "var(--color-border-hover)",
        },

        /* Status Colors */
        success: {
          DEFAULT: "var(--color-success)",
          subtle: "var(--color-success-subtle)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          subtle: "var(--color-warning-subtle)",
        },
        error: {
          DEFAULT: "var(--color-error)",
          subtle: "var(--color-error-subtle)",
        },
        info: {
          DEFAULT: "var(--color-info)",
          subtle: "var(--color-info-subtle)",
        },

        /* Role Accent Colors - Subtle contextual cues only */
        "role-student": {
          DEFAULT: "var(--role-accent-student)",
          subtle: "var(--role-accent-student-subtle)",
          border: "var(--role-accent-student-border)",
        },
        "role-teacher": {
          DEFAULT: "var(--role-accent-teacher)",
          subtle: "var(--role-accent-teacher-subtle)",
          border: "var(--role-accent-teacher-border)",
        },
        "role-admin": {
          DEFAULT: "var(--role-accent-admin)",
          subtle: "var(--role-accent-admin-subtle)",
          border: "var(--role-accent-admin-border)",
        },
      },
      spacing: {
        micro: "var(--spacing-micro)",
        compact: "var(--spacing-compact)",
        standard: "var(--spacing-standard)",
        default: "var(--spacing-default)",
        comfortable: "var(--spacing-comfortable)",
        spacious: "var(--spacing-spacious)",
        page: "var(--spacing-page)",
        "page-lg": "var(--spacing-page-lg)",
      },
      borderRadius: {
        "control-sm": "var(--radius-control-sm)",
        "control-md": "var(--radius-control-md)",
        "control-lg": "var(--radius-control-lg)",
        "container-sm": "var(--radius-container-sm)",
        "container-md": "var(--radius-container-md)",
        "container-lg": "var(--radius-container-lg)",
        button: "var(--radius-button)",
        input: "var(--radius-input)",
        card: "var(--radius-card)",
        modal: "var(--radius-modal)",
        badge: "var(--radius-badge)",
        avatar: "var(--radius-avatar)",
      },
      controlSize: {
        sm: {
          height: "var(--control-sm-height)",
          paddingX: "var(--control-sm-padding-x)",
          fontSize: "var(--control-sm-font)",
          iconSize: "var(--control-sm-icon)",
        },
        md: {
          height: "var(--control-md-height)",
          paddingX: "var(--control-md-padding-x)",
          fontSize: "var(--control-md-font)",
          iconSize: "var(--control-md-icon)",
        },
        lg: {
          height: "var(--control-lg-height)",
          paddingX: "var(--control-lg-padding-x)",
          fontSize: "var(--control-lg-font)",
          iconSize: "var(--control-lg-icon)",
        },
      },
      fontFamily: {
        sans: "var(--font-family)",
      },
      fontSize: {
        display: ["var(--font-size-display)", { lineHeight: "var(--line-height-display)", fontWeight: "var(--font-weight-display)" }],
        h1: ["var(--font-size-h1)", { lineHeight: "var(--line-height-h1)", fontWeight: "var(--font-weight-h1)" }],
        h2: ["var(--font-size-h2)", { lineHeight: "var(--line-height-h2)", fontWeight: "var(--font-weight-h2)" }],
        h3: ["var(--font-size-h3)", { lineHeight: "var(--line-height-h3)", fontWeight: "var(--font-weight-h3)" }],
        "body-lg": ["var(--font-size-body-lg)", { lineHeight: "var(--line-height-body-lg)", fontWeight: "var(--font-weight-body-lg)" }],
        body: ["var(--font-size-body)", { lineHeight: "var(--line-height-body)", fontWeight: "var(--font-weight-body)" }],
        "body-sm": ["var(--font-size-body-sm)", { lineHeight: "var(--line-height-body-sm)", fontWeight: "var(--font-weight-body-sm)" }],
        caption: ["var(--font-size-caption)", { lineHeight: "var(--line-height-caption)", fontWeight: "var(--font-weight-caption)" }],
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        normal: "var(--duration-normal)",
        slow: "var(--duration-slow)",
      },
      transitionTimingFunction: {
        "ease-default": "var(--easing-default)",
        "ease-in": "var(--easing-in)",
        "ease-out": "var(--easing-out)",
        spring: "var(--easing-spring)",
      },
    },
  },
  plugins: [],
};

export default config;
