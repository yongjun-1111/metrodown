; Windows registration for Metrodown, included by Tauri's NSIS installer (tauri.conf.json).
; - Registers the ProgId and the "Open with" entries without taking over the default app.
; - Registers Metrodown with Settings > Default apps and, if the user agrees, opens its page
;   there: Windows lets only the user set a default, so the installer cannot do it alone.
; - Removes an install made under the old name, md-viewer (0.1.x).
; The ProgId keeps the name 0.1.x used, so a default chosen then still resolves after the rename.
; SHCTX is HKCU for the per-user install, which the registeredAppUser link below expects.

!define MDV_PROGID "Markdown document"
!define MDV_EXE "metrodown.exe"
!define MDV_CAPS "Software\Metrodown\Capabilities"
!define MDV_OLD_UNINST "Software\Microsoft\Windows\CurrentVersion\Uninstall\md-viewer"

; When ".EXT" still defaults to the ProgId (0.1.0 to 0.1.3 set that), gives the default back to
; the app the old installer saved in its backup value, or clears it; then drops the backup value.
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

; A default chosen as "Applications\md-viewer.exe" (the old name) keeps working: that entry
; then opens Metrodown. Anyone else gets no such entry, so Open with lists Metrodown once.
!macro MDV_OLD_APP_ALIAS
  Push $R0
  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.md\UserChoice" "ProgId"
  StrCmp $R0 "Applications\md-viewer.exe" 0 mdv_alias_drop
  WriteRegStr SHCTX "Software\Classes\Applications\md-viewer.exe" "FriendlyAppName" "Metrodown"
  WriteRegStr SHCTX "Software\Classes\Applications\md-viewer.exe\shell\open\command" "" '"$INSTDIR\${MDV_EXE}" "%1"'
  Goto mdv_alias_done
  mdv_alias_drop:
  DeleteRegKey SHCTX "Software\Classes\Applications\md-viewer.exe"
  mdv_alias_done:
  Pop $R0
!macroend

; Asks once whether Metrodown should open .md files, unless it already does or the install is silent.
!macro MDV_OFFER_DEFAULT
  IfSilent mdv_offer_done
  Push $R0
  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.md\UserChoice" "ProgId"
  StrCmp $R0 "${MDV_PROGID}" mdv_offer_pop
  StrCmp $R0 "Applications\${MDV_EXE}" mdv_offer_pop
  StrCmp $R0 "Applications\md-viewer.exe" mdv_offer_pop
  MessageBox MB_YESNO|MB_ICONQUESTION "Use Metrodown as the default app for Markdown (.md) files?$\r$\n$\r$\nWindows Settings will open on Metrodown's page. Choose $\"Set default$\" there to finish." IDNO mdv_offer_pop
  ExecShell "open" "ms-settings:defaultapps?registeredAppUser=Metrodown"
  mdv_offer_pop:
  Pop $R0
  mdv_offer_done:
!macroend

!macro NSIS_HOOK_PREINSTALL
  ; An install under the old name has its own folder and uninstall entry; remove it first.
  Push $R0
  Push $R1
  Push $R2
  ReadRegStr $R0 SHCTX "${MDV_OLD_UNINST}" "UninstallString"
  StrCmp $R0 "" mdv_no_old
  ReadRegStr $R1 SHCTX "${MDV_OLD_UNINST}" "InstallLocation"
  StrCpy $R2 $R1 1
  StrCmp $R2 '"' 0 +2
    StrCpy $R1 $R1 -1 1 ; stored in quotes
  ; _?= makes the uninstaller run in place, so ExecWait waits for it.
  ClearErrors
  ExecWait '$R0 /S _?=$R1' $R2
  IfErrors mdv_old_failed
  StrCmp $R2 "0" 0 mdv_old_failed
  IfFileExists "$R1\md-viewer.exe" mdv_old_failed
  ; Removed: drop the uninstaller it leaves behind with _?= and the old product's own key.
  Delete "$R1\uninstall.exe"
  RMDir "$R1"
  DeleteRegKey SHCTX "Software\yongjun1111\md-viewer"
  Goto mdv_no_old
  mdv_old_failed:
  MessageBox MB_OK|MB_ICONSTOP "The previous version (md-viewer) could not be removed. Close md-viewer if it is running and run this installer again." /SD IDOK
  Abort
  mdv_no_old:
  Pop $R2
  Pop $R1
  Pop $R0
!macroend

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "Software\Classes\${MDV_PROGID}" "" "Markdown document"
  WriteRegStr SHCTX "Software\Classes\${MDV_PROGID}\DefaultIcon" "" "$INSTDIR\${MDV_EXE},0"
  WriteRegStr SHCTX "Software\Classes\${MDV_PROGID}\shell\open\command" "" '"$INSTDIR\${MDV_EXE}" "%1"'
  WriteRegStr SHCTX "Software\Classes\.md\OpenWithProgids" "${MDV_PROGID}" ""
  WriteRegStr SHCTX "Software\Classes\.markdown\OpenWithProgids" "${MDV_PROGID}" ""
  WriteRegStr SHCTX "Software\Classes\Applications\${MDV_EXE}" "FriendlyAppName" "Metrodown"
  WriteRegStr SHCTX "Software\Classes\Applications\${MDV_EXE}\SupportedTypes" ".md" ""
  WriteRegStr SHCTX "Software\Classes\Applications\${MDV_EXE}\SupportedTypes" ".markdown" ""
  WriteRegStr SHCTX "Software\Classes\Applications\${MDV_EXE}\shell\open\command" "" '"$INSTDIR\${MDV_EXE}" "%1"'
  !insertmacro MDV_OLD_APP_ALIAS
  ; Settings > Default apps lists apps registered here.
  WriteRegStr SHCTX "${MDV_CAPS}" "ApplicationName" "Metrodown"
  WriteRegStr SHCTX "${MDV_CAPS}" "ApplicationDescription" "Read-only Markdown viewer"
  WriteRegStr SHCTX "${MDV_CAPS}\FileAssociations" ".md" "${MDV_PROGID}"
  WriteRegStr SHCTX "${MDV_CAPS}\FileAssociations" ".markdown" "${MDV_PROGID}"
  WriteRegStr SHCTX "Software\RegisteredApplications" "Metrodown" "${MDV_CAPS}"
  !insertmacro MDV_DROP_LEGACY_DEFAULT "md"
  !insertmacro MDV_DROP_LEGACY_DEFAULT "markdown"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  !insertmacro MDV_OFFER_DEFAULT
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey SHCTX "Software\Classes\${MDV_PROGID}"
  DeleteRegValue SHCTX "Software\Classes\.md\OpenWithProgids" "${MDV_PROGID}"
  DeleteRegValue SHCTX "Software\Classes\.markdown\OpenWithProgids" "${MDV_PROGID}"
  DeleteRegKey SHCTX "Software\Classes\Applications\${MDV_EXE}"
  DeleteRegKey SHCTX "Software\Classes\Applications\md-viewer.exe"
  DeleteRegValue SHCTX "Software\RegisteredApplications" "Metrodown"
  DeleteRegKey SHCTX "Software\Metrodown"
  !insertmacro MDV_DROP_LEGACY_DEFAULT "md"
  !insertmacro MDV_DROP_LEGACY_DEFAULT "markdown"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
