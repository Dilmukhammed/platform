param(
    [string]$LiteLLMBaseUrl = "http://127.0.0.1:4000",
    [Parameter(Mandatory = $true)]
    [string]$Model,
    [Parameter(Mandatory = $true)]
    [string]$LiteLLMMasterKey
)

$ErrorActionPreference = "Stop"

$base = $LiteLLMBaseUrl.TrimEnd("/")
$messagesEndpoint = "$base/v1/messages"
$countTokensEndpoint = "$base/v1/messages/count_tokens"

$headers = @{
    "Content-Type" = "application/json"
    "anthropic-version" = "2023-06-01"
    "x-api-key" = $LiteLLMMasterKey
    "Authorization" = "Bearer $LiteLLMMasterKey"
}

$messagesBody = @{
    model = $Model
    max_tokens = 64
    stream = $false
    messages = @(
        @{
            role = "user"
            content = "ping"
        }
    )
} | ConvertTo-Json -Depth 20

Write-Host "Testing LiteLLM messages endpoint: $messagesEndpoint"
$response = Invoke-RestMethod -Method Post -Uri $messagesEndpoint -Headers $headers -Body $messagesBody -TimeoutSec 90

$textBlock = $null
if ($response.content) {
    $textBlock = $response.content | Where-Object { $_.type -eq "text" } | Select-Object -First 1
}

if (-not $textBlock) {
    throw "No text content found in response.content"
}

Write-Host "Messages API OK"
Write-Host "Response preview: $($textBlock.text)"

$countBody = @{
    model = $Model
    messages = @(
        @{
            role = "user"
            content = "ping"
        }
    )
} | ConvertTo-Json -Depth 20

Write-Host "Testing LiteLLM count tokens endpoint: $countTokensEndpoint"
try {
    $countResponse = Invoke-RestMethod -Method Post -Uri $countTokensEndpoint -Headers $headers -Body $countBody -TimeoutSec 90
    if ($null -ne $countResponse) {
        Write-Host "Count tokens API OK"
    }
}
catch {
    Write-Warning "Count tokens check failed. Core chat may still work, but some features can degrade."
    Write-Warning $_
}

Write-Host "LiteLLM Anthropic endpoint smoke test finished successfully."
