# Use the installed Windows Thai voice directly without changing the registry.
$qcRoot = Split-Path -Parent $PSScriptRoot
$qcNarration = Get-Content -LiteralPath (Join-Path $qcRoot 'video/narration-th.json') -Raw -Encoding utf8 | ConvertFrom-Json
$qcToken = New-Object -ComObject SAPI.SpObjectToken
$qcToken.SetId('HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Speech_OneCore\Voices\Tokens\MSTTS_V110_thTH_Pattara')
$qcVoice = New-Object -ComObject SAPI.SpVoice
$qcVoice.Voice = $qcToken
$qcVoice.Rate = 0
for ($qcScene = 0; $qcScene -lt $qcNarration.Count; $qcScene++) {
    $qcWavePath = Join-Path $qcRoot ('video/public/narration/step-' + ($qcScene + 1).ToString('00') + '.wav')
    $qcStream = New-Object -ComObject SAPI.SpFileStream
    try {
        $qcStream.Open($qcWavePath, 3, $false)
        $qcVoice.AudioOutputStream = $qcStream
        $null = $qcVoice.Speak($qcNarration[$qcScene])
    } finally { $qcStream.Close() }
}
