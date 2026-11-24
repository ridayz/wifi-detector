// wifiscan.exe — native WiFi environmental scan for wifi-detector.
// Compile: csc /nologo /target:exe /out:native\wifiscan.exe native\WifiScan.cs
// Prints one JSON line to stdout. Read-only; never transmits.
// See docs/DECISIONS/0004-native-wifi-scanner.md
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

[StructLayout(LayoutKind.Sequential, Pack = 8)]
struct DOT11_SSID
{
    public uint uSSIDLength;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 32)]
    public byte[] ucSSID;
}

[StructLayout(LayoutKind.Sequential, Pack = 8)]
struct WLAN_RATE_SET
{
    public uint uRateSetLength;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 252)]
    public byte[] usRateSet;
}

[StructLayout(LayoutKind.Sequential, Pack = 8)]
struct WLAN_BSS_ENTRY
{
    public DOT11_SSID dot11Ssid;      // +0, 36 bytes
    public uint uPhyId;               // +36
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 6)]
    public byte[] dot11Bssid;         // +40
    public uint dot11BssType;         // +48
    public uint dot11BssPhyType;      // +52
    public int lRssi;                 // +56
    public uint uLinkQuality;         // +60
    public byte bInRegDomain;         // +64
    public ushort usBeaconPeriod;     // +66
    public ulong ullTimestamp;        // +72
    public ulong ullHostTimestamp;    // +80
    public ushort usCapabilityInformation; // +88
    public uint ulChCenterFrequency;  // +92, kHz
    public WLAN_RATE_SET wlanRateSet; // +96, +256
    public uint ulIeOffset;           // +352
    public uint ulIeSize;             // +356
}                                     // SizeOf == 360

static class WifiScan
{
    const int WLAN_CLIENT_VERSION = 2;
    const uint dot11_bss_infrastructure = 1;

    [DllImport("wlanapi.dll")] static extern uint WlanOpenHandle(uint dwClientVersion, IntPtr pReserved, out uint pdwNegotiatedVersion, out IntPtr phClientHandle);
    [DllImport("wlanapi.dll")] static extern uint WlanEnumInterfaces(IntPtr hClientHandle, IntPtr pReserved, out IntPtr ppInterfaceList);
    [DllImport("wlanapi.dll")] static extern uint WlanCloseHandle(IntPtr hClientHandle, IntPtr pReserved);
    [DllImport("wlanapi.dll")] static extern uint WlanScan(IntPtr hClientHandle, ref Guid pInterfaceGuid, IntPtr pDot11Ssid, IntPtr pIeData, IntPtr pReserved);
    [DllImport("wlanapi.dll")] static extern uint WlanGetNetworkBssList(IntPtr hClientHandle, ref Guid pInterfaceGuid, IntPtr pDot11Ssid, uint dot11BssType, uint bSecurityEnabled, IntPtr pReserved, out IntPtr ppWlanBssList);
    [DllImport("wlanapi.dll")] static extern uint WlanFreeMemory(IntPtr pMemory);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct WLAN_INTERFACE_INFO
    {
        public Guid InterfaceGuid;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string strInterfaceDescription;
        public uint isState;
    }

    static int Main(string[] args)
    {
        try
        {
            bool scan = Array.IndexOf(args ?? new string[0], "--no-scan") < 0;
            string json = Scan(scan);
            Console.Out.WriteLine(json);
            return 0;
        }
        catch (Exception ex)
        {
            Console.Out.WriteLine("{\"ok\":false,\"message\":\"" + Escape(ex.Message) + "\"}");
            return 1;
        }
    }

    static string Scan(bool withScan)
    {
        IntPtr handle;
        uint negotiated;
        if (WlanOpenHandle(WLAN_CLIENT_VERSION, IntPtr.Zero, out negotiated, out handle) != 0)
            throw new Exception("WlanOpenHandle failed");

        IntPtr listPtr;
        if (WlanEnumInterfaces(handle, IntPtr.Zero, out listPtr) != 0)
        {
            WlanCloseHandle(handle, IntPtr.Zero);
            throw new Exception("WlanEnumInterfaces failed");
        }

        uint numberOfItems = (uint)Marshal.ReadInt32(listPtr, 0);
        IntPtr ptr = new IntPtr(listPtr.ToInt64() + 8);
        int infoSize = Marshal.SizeOf(typeof(WLAN_INTERFACE_INFO));

        var sb = new StringBuilder();
        sb.Append("{\"ok\":true,\"capturedAt\":\"")
          .Append(DateTime.UtcNow.ToString("o"))
          .Append("\",\"networks\":[");

        bool first = true;
        int expected = Marshal.SizeOf(typeof(WLAN_BSS_ENTRY));
        for (int i = 0; i < (int)numberOfItems; i++)
        {
            var info = (WLAN_INTERFACE_INFO)Marshal.PtrToStructure(ptr, typeof(WLAN_INTERFACE_INFO));
            AppendFor(handle, ref info, sb, ref first, withScan);
            ptr = new IntPtr(ptr.ToInt64() + infoSize);
        }
        sb.Append("]}");
        WlanCloseHandle(handle, IntPtr.Zero);
        return sb.ToString();
    }

    static void AppendFor(IntPtr handle, ref WLAN_INTERFACE_INFO info, StringBuilder sb, ref bool first, bool withScan)
    {
        Guid g = info.InterfaceGuid;
        // Optionally force a scan; without it we read the driver's cached BSS list (fast).
        if (withScan)
        {
            WlanScan(handle, ref g, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
            System.Threading.Thread.Sleep(2500); // let the scan land; driver-dependent
        }

        IntPtr bssList;
        if (WlanGetNetworkBssList(handle, ref g, IntPtr.Zero, dot11_bss_infrastructure, 0, IntPtr.Zero, out bssList) != 0)
            return;

        uint n = (uint)Marshal.ReadInt32(bssList, 4);
        int entrySize = Marshal.SizeOf(typeof(WLAN_BSS_ENTRY));
        int offset = 8; // { dwTotalLength(4), dwNumberOfItems(4) } — entries start at +8

        for (int j = 0; j < (int)n; j++)
        {
            IntPtr entryPtr = new IntPtr(bssList.ToInt64() + offset + j * (long)entrySize);
            var e = (WLAN_BSS_ENTRY)Marshal.PtrToStructure(entryPtr, typeof(WLAN_BSS_ENTRY));
            string ssid = e.dot11Ssid.ucSSID != null ? Encoding.UTF8.GetString(e.dot11Ssid.ucSSID, 0, (int)Math.Min(e.dot11Ssid.uSSIDLength, 32u)).TrimEnd('\0') : "";
            string bssid = e.dot11Bssid != null ? string.Join(":", Array.ConvertAll(e.dot11Bssid, b => b.ToString("x2"))).ToUpper() : null;
            string phy = PhyName(e.dot11BssPhyType);
            int freqMhz = (int)(e.ulChCenterFrequency / 1000);
            if (!first) sb.Append(',');
            first = false;
            sb.Append("{\"ssid\":\"").Append(Escape(ssid))
              .Append("\",\"bssid\":").Append(bssid == null ? "null" : "\"" + bssid + "\"")
              .Append(",\"freqMhz\":").Append(freqMhz)
              .Append(",\"phyType\":").Append(e.dot11BssPhyType)
              .Append(",\"radio\":\"").Append(phy)
              .Append("\",\"rssiDbm\":").Append(e.lRssi)
              .Append(",\"signalPct\":").Append(e.uLinkQuality)
              .Append('}');
        }
        WlanFreeMemory(bssList);
    }

    static string PhyName(uint phyType)
    {
        switch (phyType) {
            case 1: return "802.11";
            case 2: return "802.11b";
            case 3: return "802.11a";
            case 4: return "802.11g";
            case 6: return "802.11n";
            case 7: return "802.11ac";
            case 8: return "802.11ax";
            case 10: return "802.11be";
            default: return "unknown";
        }
    }

    static string Escape(string s)
    {
        if (s == null) return "";
        var sb = new StringBuilder(s.Length + 8);
        foreach (char c in s)
        {
            switch (c)
            {
                case '\\': sb.Append("\\\\"); break;
                case '"': sb.Append("\\\""); break;
                case '\b': sb.Append("\\b"); break;
                case '\f': sb.Append("\\f"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
                    else sb.Append(c);
                    break;
            }
        }
        return sb.ToString();
    }
}
