Extract the design language from a writing app or reference site using the designlang skill.

URL to extract: $ARGUMENTS

Instructions:
1. Run: npx designlang <url> --screenshots
2. Save outputs to docs/design-extracts/<domain>/
3. Identify: primary colors, typography, spacing scale, component patterns
4. Compare against ForgeWriter design tokens (docs/superpowers/specs/2026-06-08-tech-stack-design.md)
5. Produce a summary of what to adopt vs. what to do differently

Primary reference sites to extract when no URL given:
- https://www.novelcrafter.com (primary inspiration)
- https://www.sudowrite.com
