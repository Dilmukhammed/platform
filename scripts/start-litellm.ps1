param(
    [Parameter(Mandatory = $true)]
    [string]$UpstreamApiBase,

    [Parameter(Mandatory = $true)]
    [string]$UpstreamModel,

    [Parameter(Mandatory = $true)]
    [string]$UpstreamApiKey,

    [string]$ClaudePickerModelId = "my-provider-model",
    [string]$LiteLLMMasterKey = "sk-local-litellm"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command litellm -ErrorAction SilentlyContinue)) {
    throw "litellm command not found. Install with: pip install 'litellm[proxy]'"
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
$templatePath = Join-Path $repoRoot "litellm/config.template.yaml"
$configPath = Join-Path $repoRoot "litellm/config.local.yaml"

if (-not (Test-Path $templatePath)) {
    throw "Template not found: $templatePath"
}

$template = Get-Content -Raw -Path $templatePath
$config = $template.Replace("__CLAUDE_PICKER_MODEL_ID__", $ClaudePickerModelId).Replace("__LITELLM_PROVIDER_AND_MODEL__", $UpstreamModel)

Set-Content -Path $configPath -Value $config -Encoding UTF8

$env:UPSTREAM_API_BASE = $UpstreamApiBase
$env:UPSTREAM_API_KEY = $UpstreamApiKey
$env:LITELLM_MASTER_KEY = $LiteLLMMasterKey

Write-Host "LiteLLM config generated: $configPath"
Write-Host "Starting LiteLLM on default port 4000"
litellm --config $configPath
