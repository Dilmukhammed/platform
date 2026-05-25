# Claude Variant A Setup

This setup configures:
Claude Code -> LiteLLM -> your provider

## Files

- litellm/config.template.yaml
- scripts/start-litellm.ps1
- scripts/check-litellm-anthropic-endpoint.ps1
- scripts/apply-claude-litellm-settings.ps1

## Required inputs

1. Upstream API base URL
2. Upstream model ID in LiteLLM provider format
3. Upstream API key
4. Local LiteLLM master key (can be any strong local key)
5. Claude picker model ID (friendly alias used in /model)

## Step 1: start LiteLLM

PowerShell example:

./scripts/start-litellm.ps1 \
  -UpstreamApiBase "https://YOUR_PROVIDER_BASE_URL" \
  -UpstreamModel "openai/YOUR_MODEL" \
  -UpstreamApiKey "YOUR_UPSTREAM_API_KEY" \
  -ClaudePickerModelId "my-provider-model" \
  -LiteLLMMasterKey "sk-local-litellm"

## Step 2: verify LiteLLM endpoint

./scripts/check-litellm-anthropic-endpoint.ps1 \
  -LiteLLMBaseUrl "http://127.0.0.1:4000" \
  -Model "my-provider-model" \
  -LiteLLMMasterKey "sk-local-litellm"

## Step 3: apply Claude local settings

./scripts/apply-claude-litellm-settings.ps1 \
  -LiteLLMBaseUrl "http://127.0.0.1:4000" \
  -ModelId "my-provider-model" \
  -LiteLLMMasterKey "sk-local-litellm" \
  -ModelDisplayName "My Provider via LiteLLM" \
  -ModelDescription "Routed through LiteLLM"

## Step 4: run Claude Code

Start Claude Code in this repository and pick model "my-provider-model" in /model.
