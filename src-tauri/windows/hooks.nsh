; Registers md-viewer for Markdown files without taking over the user's default app: the ProgId
; plus the two places Windows builds the "Open with" list from (OpenWithProgids and the
; Applications key). The user picks md-viewer as the default there ("Always").
; The ProgId keeps the name earlier versions used, so a default chosen then still resolves.

!define MDV_PROGID "Markdown document"

; When ".EXT" still defaults to md-viewer's ProgId, gives the default back to the app the old
; installer saved in its backup value (or clears it), then drops the backup value.
!macro MDV_DROP_LEGACY_DEFAULT EXT
  Push $R0
  Push $R1
  ReadRegStr $R0 SHCTX "Software\Classes\.${EXT}" ""
  ReadRegStr $R1 SHCTX "Software\Classes\.${EXT}" "${MDV_PROGID}_backup"
  StrCmp $R0 "${MDV_PROGID}" 0 mdv_done_${EXT}
  StrCmp $R1 "" mdv_clear_${EXT}
  StrCmp $R1 "${MDV_PROGID}" mdv_clear_${EXT}
  WriteRegStr SHCTX "Software\Classes\.${EXT}" "" "$R1"
  Goto mdv_done_${EXT}
  mdv_clear_${EXT}:
  DeleteRegValue SHCTX "Software\Classes\.${EXT}" ""
  mdv_done_${EXT}:
  DeleteRegValue SHCTX "Software\Classes\.${EXT}" "${MDV_PROGID}_backup"
  Pop $R1
  Pop $R0
!macroend

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "Software\Classes\${MDV_PROGID}" "" "Markdown document"
  WriteRegStr SHCTX "Software\Classes\${MDV_PROGID}\DefaultIcon" "" "$INSTDIR\md-viewer.exe,0"
  WriteRegStr SHCTX "Software\Classes\${MDV_PROGID}\shell\open\command" "" '"$INSTDIR\md-viewer.exe" "%1"'
  WriteRegStr SHCTX "Software\Classes\.md\OpenWithProgids" "${MDV_PROGID}" ""
  WriteRegStr SHCTX "Software\Classes\.markdown\OpenWithProgids" "${MDV_PROGID}" ""
  WriteRegStr SHCTX "Software\Classes\Applications\md-viewer.exe" "FriendlyAppName" "md-viewer"
  WriteRegStr SHCTX "Software\Classes\Applications\md-viewer.exe\SupportedTypes" ".md" ""
  WriteRegStr SHCTX "Software\Classes\Applications\md-viewer.exe\SupportedTypes" ".markdown" ""
  WriteRegStr SHCTX "Software\Classes\Applications\md-viewer.exe\shell\open\command" "" '"$INSTDIR\md-viewer.exe" "%1"'
  ; Versions 0.1.0 to 0.1.3 also made md-viewer the extension's fallback default; undo that part.
  !insertmacro MDV_DROP_LEGACY_DEFAULT "md"
  !insertmacro MDV_DROP_LEGACY_DEFAULT "markdown"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey SHCTX "Software\Classes\${MDV_PROGID}"
  DeleteRegValue SHCTX "Software\Classes\.md\OpenWithProgids" "${MDV_PROGID}"
  DeleteRegValue SHCTX "Software\Classes\.markdown\OpenWithProgids" "${MDV_PROGID}"
  DeleteRegKey SHCTX "Software\Classes\Applications\md-viewer.exe"
  !insertmacro MDV_DROP_LEGACY_DEFAULT "md"
  !insertmacro MDV_DROP_LEGACY_DEFAULT "markdown"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
