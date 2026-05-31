// All visual styles for MapScreen. Extracted from MapScreen.js to keep that file focused
// on logic. The grouping below mirrors how the components are laid out on screen so it's
// easy to find a rule from the UI: HUD/info bar → map → modals → bottom tab bar → pins.

import { StyleSheet, Dimensions } from "react-native";

// Map fills the whole window; both dimensions are read once at module load.
const { width, height } = Dimensions.get("window");

const styles = StyleSheet.create({
  // ----- Root layout -----
  // Root wrapper for the whole screen.
  container: { flex: 1, backgroundColor: "#fff" },
  // The MapView fills the available space (width x height of the device window).
  map: { width: width, height: height },

  // ----- Center-screen toast (success / warning / error notices) -----
  // Floating banner positioned at vertical center of the screen.
  toastContainer: {
    position: "absolute",
    top: "50%",
    left: 20,
    right: 20,
    transform: [{ translateY: -25 }], // Pull up by half its height to truly center.
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 4,
    // borderLeftColor is set inline based on toast type (success/error/info/warning).
  },
  // Text inside the toast.
  toastText: {
    color: "#333",
    fontSize: 14,
    fontWeight: "400",
    textAlign: "left",
    marginLeft: 12,
    flex: 1,
    lineHeight: 18,
  },

  // ----- Legacy "Get Location" button (kept for backward compatibility) -----
  locationButton: {
    position: "absolute",
    bottom: 5,
    right: 5,
    backgroundColor: "#2196F3",
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 30,
    elevation: 6,
    zIndex: 10,
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },

  // ----- Top-right cluster (Abort button + Layers dropdown wrapper) -----
  // Anchors the floating top-right controls.
  topRightContainer: {
    position: "absolute",
    top: 10,
    right: 15,
    zIndex: 30,
    alignItems: "flex-end",
  },
  // Wrapper that keeps the dropdown right-aligned under its trigger.
  topDropdownContainer: { alignItems: "flex-end" },
  // The "Layers" button itself.
  topLayersBtn: {
    backgroundColor: "#2196F3",
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 18,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    minWidth: 80,
    alignItems: "center",
  },
  topLayersBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  // Dropdown panel that appears under "Layers".
  topDropdownMenu: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 8,
    elevation: 6,
    shadowColor: "#2196F3",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    minWidth: 140,
  },

  // ----- Generic floating menus (top / bottom variants) -----
  floatingMenu: {
    position: "absolute",
    top: 10,
    right: 0,
    flexDirection: "column",
    alignItems: "flex-end",
    zIndex: 30,
  },
  bottomFloatingMenu: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 30,
  },

  // ----- Reusable round icon button -----
  // Round 55x55 button used by abort/etc — both Android `elevation` and iOS `shadow*` set
  // so the floating effect renders consistently on both platforms.
  iconBtn: {
    backgroundColor: "#4CAF50",
    width: 55,
    height: 55,
    borderRadius: 27.5,
    justifyContent: "center",
    alignItems: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    marginRight: 12,
    zIndex: 999,
  },
  iconBtnText: { fontSize: 20, color: "#fff" },

  // ----- "My Location" button — slightly bigger + bordered for prominence -----
  myLocationBtn: {
    backgroundColor: "#4CAF50",
    width: 65,
    height: 65,
    borderRadius: 32.5,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    marginRight: 12,
    zIndex: 999,
    borderWidth: 2,
    borderColor: "#fff", // White ring makes it pop against any map background.
  },
  myLocationBtnText: {
    fontSize: 26,
    color: "#fff",
    textShadowColor: "#000",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  // ----- Bottom dropdown (e.g. "Center Map" picker) -----
  bottomDropdownContainer: { flex: 1, marginHorizontal: 5, alignItems: "center" },
  bottomMenuBtn: {
    backgroundColor: "#2196F3",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    minWidth: 100,
    alignItems: "center",
  },
  bottomMenuBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  // Popover that opens upward from the bottom button.
  bottomDropdownMenu: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
    elevation: 6,
    shadowColor: "#2196F3",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    minWidth: 140,
    position: "absolute",
    bottom: 50,
    left: 0,
    right: 0,
  },

  // ----- Generic small menu pill -----
  menuBtn: {
    backgroundColor: "#2196F3",
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 18,
    marginBottom: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    marginRight: 8,
  },
  menuBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },

  // ----- Generic dropdown (right-aligned, opens downward) -----
  dropdownContainer: { width: "100%", alignItems: "flex-end" },
  dropdownMenu: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 2,
    marginBottom: 8,
    elevation: 6,
    shadowColor: "#2196F3",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    minWidth: 140,
  },
  dropdownItem: { paddingVertical: 8, paddingHorizontal: 6 },
  dropdownItemText: { fontSize: 15, color: "#185a9d", fontWeight: "600" },

  // ----- Top-left HUD card (time remaining / checkpoint count / speed) -----
  infoBar: {
    position: 'absolute',
    top: 10,
    left: 5,
    backgroundColor: 'rgba(255,255,255,0.92)', // Slight transparency so the map shows through.
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'column',
    alignItems: 'flex-start',
    zIndex: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  infoText: { fontSize: 12, fontWeight: '600', color: '#185a9d', marginBottom: 2 },

  // ----- Checkpoint history modal (table-like layout) -----
  // Dimmer behind the modal.
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  // Modal card.
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    alignItems: 'center',
  },
  // Sticky header row inside the modal table.
  modalHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    paddingVertical: 8,
    marginBottom: 2,
    width: '100%',
  },
  modalHeaderCell: { fontSize: 14, fontWeight: 'bold', color: '#185a9d', textAlign: 'center' },
  // Individual column widths / alignments for the modal header.
  modalHeaderCellLeft: { width: '15%', textAlign: 'left', paddingLeft: 8 },
  modalHeaderCellCenter: { width: '35%', textAlign: 'left', paddingLeft: 4 },
  modalHeaderCellTimeRight: { width: '20%', textAlign: 'center', paddingRight: 8 },
  modalHeaderCellRight: { width: '38%', textAlign: 'center', paddingRight: 8 },
  // Data row in the modal table.
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 8,
    marginBottom: 2,
    width: '100%',
  },
  // Zebra-stripe background colors for readability.
  modalRowEven: { backgroundColor: '#f7fbff' },
  modalRowOdd: { backgroundColor: '#e9f5fe' },
  modalCell: { fontSize: 12, color: '#333', textAlign: 'center', paddingVertical: 2, paddingHorizontal: 5 },
  modalCellLeft: { width: '15%', textAlign: 'left', paddingLeft: 8 },
  modalCellCenter: { width: '30%', textAlign: 'left', paddingLeft: 4 },
  modalCellTimeRight: { width: '30%', textAlign: 'center', paddingRight: 8 },
  modalCellRight: { width: '30%', textAlign: 'center', paddingRight: 8 },
  modalDivider: { height: 1, backgroundColor: '#b3c6e0', width: '100%', marginVertical: 12, borderRadius: 2 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#185a9d', marginBottom: 18, textAlign: 'center' },
  // Modal close button.
  closeBtn: { marginTop: 18, backgroundColor: '#2196F3', paddingVertical: 10, paddingHorizontal: 28, borderRadius: 22 },
  closeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  totalCountText: { marginTop: 10, fontSize: 16, fontWeight: 'bold', color: '#185a9d', textAlign: 'center' },

  // ----- Bottom tab bar (History / My Location / SOS) -----
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: -2 }, // Shadow goes upward so the bar floats off the map.
    shadowRadius: 4,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  tabItemLast: { marginRight: 0 },
  // Colored circular badge behind the tab emoji icon.
  tabIconContainer: {
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  tabIcon: { fontSize: 16, color: '#fff' },
  tabLabel: { fontSize: 10, color: '#666', fontWeight: '600', textAlign: 'center', marginTop: 1 },

  // ----- iOS custom checkpoint pin (Google-style teardrop) -----
  // On iOS the built-in Marker pinColor only supports a few named colors, so we render a
  // custom View (circle head + triangle tail) that takes the marker's hex color reliably.
  customPinWrapper: { alignItems: 'center', justifyContent: 'center', width: 30, height: 40 },
  // Circle "head" of the pin.
  customPinHead: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 2,
  },
  // White dot inside the pin head.
  customPinInnerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  // Downward-pointing triangle "tail" rendered via border tricks.
  customPinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
});

export default styles;
