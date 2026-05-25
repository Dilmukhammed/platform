param(
    [string]$LiteLLMBaseUrl = "http://127.0.0.1:4000",
    [Parameter(Mandatory = $true)]
    [string]$ModelId,
    [Parameter(Mandatory = $true)]
    [string]$LiteLLMMasterKey,
    [string]$ModelDisplayName = "Provider model via LiteLLM",
    [string]$ModelDescription = "Custom provider model routed through LiteLLM"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
$claudeDir = Join-Path $repoRoot ".claude"
$settingsPath = Join-Path $claudeDir "settings.local.json"

if (-not (Test-Path $claudeDir)) {
    New-Item -ItemType Directory -Path $claudeDir | Out-Null
}

$settings = @{
    '$schema' = "https://json.schemastore.org/claude-code-settings.json"
    env = @{
        ANTHROPIC_BASE_URL = $LiteLLMBaseUrl
        ANTHROPIC_AUTH_TOKEN = $LiteLLMMasterKey
        ANTHROPIC_CUSTOM_MODEL_OPTION = $ModelId
        ANTHROPIC_CUSTOM_MODEL_OPTION_NAME = $ModelDisplayName
        ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION = $ModelDescription
        ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES = "effort,thinking,adaptive_thinking,interleaved_thinking"
    }
}

$settings | ConvertTo-Json -Depth 20 | Set-Content -Path $settingsPath -Encoding UTF8
Write-Host "Claude local settings written: $settingsPath"
