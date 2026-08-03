# Worship Keys — Offline Church Mode

Offline Church Mode runs pad audio, MIDI, Nashville and every Join device on the
church Mac and its local router. The service does not require internet, Vercel,
Supabase or Google Drive.

## Prepare before Sunday

1. Prepare the setlist at `https://worship-keys-psi.vercel.app/play` on the phone.
2. Open **Google Drive** and choose **Deploy to Google Drive**.
3. While the Mac still has internet, open Worship Keys and choose
   **Open setlist from Drive**.
4. Confirm **Saved on this device**. This local copy is the Sunday fallback.
5. Install or refresh the Mac launcher from this project directory:

   ```bash
   npm run church:install
   ```

The installer creates **Worship Keys Church.app** in the current macOS user's
Applications folder. It uses the original Worship Keys icon and opens the local
host without a Terminal window.

## Sunday without internet

1. Connect the Mac to the church router with Ethernet or its local Wi-Fi.
2. If the router has no wireless radio, connect a Wi-Fi access point to it so
   phones and tablets can join the same network.
3. Open **Worship Keys Church** from Applications.
4. In **Offline Church Mode**, choose **Check all offline pads**.
5. Wait for **READY · INTERNET NOT REQUIRED**.
6. Choose **Show local join QR**. The QR must start with a private address such
   as `http://192.168…`, `http://10…` or `http://172.16–31…` — never Vercel.
7. Musicians join the router/access-point network and scan the QR.

The first time, macOS may ask whether Node may accept incoming network
connections. Choose **Allow**. Keep the Mac awake and connected to power during
the service.

## Troubleshooting

- **No Router IP:** connect Ethernet/Wi-Fi, then restart the Church app.
- **Wrong adapter selected:** launch with `WK_LAN_IP=192.168.x.x` from the
  project as an advanced override, then reinstall when the network is stable.
- **Devices cannot open the QR:** confirm they are on the same router and that
  macOS Firewall allows incoming connections for Node.
- **Pads not ready:** press **Check all offline pads** and wait for 12/12.
- **App does not start:** inspect `~/Library/Logs/Worship Keys/church-host.log`.
