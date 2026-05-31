// All three modals used by MapScreen, extracted so the main file stays focused on logic.
// Each component is dumb: it takes data + callbacks via props and renders.

import React from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import styles from "./MapScreen.styles";

// Read-only list of checkpoints + the running completion status. Shown when the user
// taps the bottom-bar "History" tab during an event.
export const CheckpointHistoryModal = ({
  visible,
  onClose,
  checkpoints,
  checkpointStatus,
}) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Checklist Details</Text>
        <View style={styles.modalHeaderRow}>
          <Text style={[styles.modalHeaderCell, styles.modalHeaderCellLeft]}>Sr.</Text>
          <Text style={[styles.modalHeaderCell, styles.modalHeaderCellCenter]}>Checkpoint</Text>
          <Text style={[styles.modalHeaderCell, styles.modalHeaderCellTimeRight]}>Time</Text>
          <Text style={[styles.modalHeaderCell, styles.modalHeaderCellRight]}>Status</Text>
        </View>
        <ScrollView style={{ maxHeight: 350, width: '100%' }}>
          {checkpoints.map((cp, idx) => {
            const statusObj = checkpointStatus[cp.checkpoint_id];
            return (
              <View
                key={cp.checkpoint_id || idx}
                style={[styles.modalRow, idx % 2 === 0 ? styles.modalRowEven : styles.modalRowOdd]}
              >
                <Text style={[styles.modalCell, styles.modalCellLeft]}>{idx + 1}</Text>
                <Text style={[styles.modalCell, styles.modalCellCenter]}>
                  {cp.checkpoint_name || `Checkpoint ${idx + 1}`}
                </Text>
                <Text style={[styles.modalCell, styles.modalCellRight]}>{statusObj?.time || '-'}</Text>
                <Text style={[styles.modalCell, styles.modalCellRight]}>
                  {statusObj?.completed ? 'Completed' : 'Not Completed'}
                </Text>
              </View>
            );
          })}
        </ScrollView>
        <View style={styles.modalDivider} />
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Close</Text>
        </TouchableOpacity>
        <Text style={styles.totalCountText}>Total Checkpoints: {checkpoints.length}</Text>
      </View>
    </View>
  </Modal>
);

// Shown once the event finishes (or after FINISH checkpoint syncs). Auto-dismisses after
// `okayTimeout` seconds via the parent; the OK button colors itself red in the final 5s
// to warn the user the auto-navigation is about to fire.
export const EventCompletedModal = ({
  visible,
  checkpoints,
  checkpointStatus,
  okayTimeout,
  onConfirm,
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={() => true}>
    <View style={modalLocal.completedOverlay}>
      <View style={modalLocal.completedCard}>
        <Text style={modalLocal.completedTitle}>🎉 Event Completed!</Text>
        <Text style={modalLocal.completedSubtitle}>
          Congratulations! All done. Redirecting to home...
        </Text>

        <View style={{ width: '100%', marginBottom: 12 }}>
          <Text style={modalLocal.completedSectionTitle}>📋 Checkpoint History</Text>

          <View style={styles.modalHeaderRow}>
            <Text style={[styles.modalHeaderCell, styles.modalHeaderCellLeft]}>Sr.</Text>
            <Text style={[styles.modalHeaderCell, styles.modalHeaderCellCenter]}>Checkpoint</Text>
            <Text style={[styles.modalHeaderCell, styles.modalHeaderCellTimeRight]}>Time</Text>
            <Text style={[styles.modalHeaderCell, styles.modalHeaderCellRight]}>Status</Text>
          </View>

          <ScrollView style={{ maxHeight: 200, width: '100%' }}>
            {checkpoints.map((cp, idx) => {
              const statusObj = checkpointStatus[cp.checkpoint_id];
              return (
                <View
                  key={cp.checkpoint_id || idx}
                  style={[styles.modalRow, idx % 2 === 0 ? styles.modalRowEven : styles.modalRowOdd]}
                >
                  <Text style={[styles.modalCell, styles.modalCellLeft]}>{idx + 1}</Text>
                  <Text style={[styles.modalCell, styles.modalCellCenter]}>
                    {cp.checkpoint_name || `Checkpoint ${idx + 1}`}
                  </Text>
                  <Text style={[styles.modalCell, styles.modalCellRight]}>{statusObj?.time || '-'}</Text>
                  <Text style={[styles.modalCell, styles.modalCellRight, { color: statusObj?.completed ? '#4CAF50' : '#F44336' }]}>
                    {statusObj?.completed ? '✓' : '✗'}
                  </Text>
                </View>
              );
            })}
          </ScrollView>

          <Text style={modalLocal.completedTotalText}>
            Total: {Object.values(checkpointStatus).filter(s => s.completed).length}/{checkpoints.length} completed
          </Text>
        </View>

        {/* Button turns red in the last 5 seconds before auto-dismiss. */}
        <TouchableOpacity
          style={[
            modalLocal.completedBtn,
            okayTimeout <= 5 && modalLocal.completedBtnUrgent,
          ]}
          onPress={onConfirm}
        >
          <Text style={modalLocal.completedBtnText}>
            OK{okayTimeout > 0 ? ` (${okayTimeout})` : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

// Abort flow: a randomly-generated 4-digit code is shown; the user must re-type it to
// confirm. Wrapped in KeyboardAvoidingView so the input stays visible above the keyboard.
export const AbortPasswordModal = ({
  visible,
  abortCode,
  enteredCode,
  onEnteredCodeChange,
  onRegenerate,
  onCancel,
  onConfirm,
  loading,
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableOpacity style={modalLocal.abortBackdrop} activeOpacity={1} onPress={() => {}}>
        <TouchableOpacity activeOpacity={1} style={{ width: '90%', maxWidth: 400 }}>
          <View style={modalLocal.abortCard}>
            <Text style={modalLocal.abortTitle}>⚠️ Abort Event</Text>
            <Text style={modalLocal.abortSubtitle}>
              To confirm event abort, enter the code below:
            </Text>

            <View style={modalLocal.abortCodeBox}>
              <View>
                <Text style={modalLocal.abortCodeLabel}>ABORT CODE:</Text>
                <Text style={modalLocal.abortCodeValue}>{abortCode}</Text>
              </View>
              <TouchableOpacity style={modalLocal.abortRegenBtn} onPress={onRegenerate}>
                <Text style={modalLocal.abortRegenBtnText}>Generate{'\n'}New Code</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={modalLocal.abortInput}
              placeholder="Enter 4-digit code"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              maxLength={4}
              value={enteredCode}
              onChangeText={onEnteredCodeChange}
              autoFocus={false}
            />

            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity style={modalLocal.abortCancelBtn} onPress={onCancel}>
                <Text style={modalLocal.abortBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalLocal.abortConfirmBtn, loading && modalLocal.abortConfirmBtnDisabled]}
                onPress={onConfirm}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={modalLocal.abortBtnText}>Abort</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  </Modal>
);

// Modal-local styles — kept here so the shared MapScreen.styles file only holds rules
// that the main screen also uses.
const modalLocal = {
  // ----- Event-completed modal -----
  completedOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  completedCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center',
    width: '90%', maxHeight: '90%', elevation: 10,
    shadowColor: '#000', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8,
  },
  completedTitle: { fontSize: 26, fontWeight: 'bold', color: '#185a9d', marginBottom: 4, textAlign: 'center' },
  completedSubtitle: { fontSize: 14, color: '#666', marginBottom: 14, textAlign: 'center' },
  completedSectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#185a9d', marginBottom: 8, textAlign: 'center' },
  completedTotalText: { fontSize: 13, fontWeight: 'bold', color: '#555', marginTop: 8, textAlign: 'center' },
  completedBtn: {
    backgroundColor: '#185a9d', paddingVertical: 13, paddingHorizontal: 44,
    borderRadius: 25, elevation: 6, marginTop: 4, minWidth: 160, alignItems: 'center',
  },
  // Urgent style swaps in for the last 5 seconds of countdown.
  completedBtnUrgent: { backgroundColor: '#D32F2F', borderWidth: 2, borderColor: '#FF5722' },
  completedBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },

  // ----- Abort modal -----
  abortBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' },
  abortCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', width: '100%',
    elevation: 50, shadowColor: '#000', shadowOpacity: 0.5, shadowOffset: { width: 0, height: 10 }, shadowRadius: 20,
  },
  abortTitle: { fontSize: 24, fontWeight: 'bold', color: '#FF5722', marginBottom: 10, textAlign: 'center' },
  abortSubtitle: { fontSize: 14, color: '#333', marginBottom: 14, textAlign: 'center', lineHeight: 20 },
  abortCodeBox: {
    backgroundColor: '#fff5f2', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 15,
    marginBottom: 14, borderWidth: 2, borderColor: '#FF5722', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', width: '100%',
  },
  abortCodeLabel: { fontSize: 11, color: '#666', fontWeight: 'bold' },
  abortCodeValue: { fontSize: 28, fontWeight: 'bold', color: '#FF5722', letterSpacing: 8, fontFamily: 'monospace' },
  abortRegenBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#6c757d', borderRadius: 8 },
  abortRegenBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  abortInput: {
    width: '100%', borderWidth: 2, borderColor: '#FF5722', borderRadius: 15,
    paddingVertical: 12, paddingHorizontal: 20, fontSize: 22, marginBottom: 18,
    backgroundColor: '#fff', textAlign: 'center', letterSpacing: 6, fontFamily: 'monospace', color: 'black',
  },
  abortCancelBtn: { backgroundColor: '#6c757d', paddingVertical: 15, borderRadius: 25, flex: 1, elevation: 3 },
  abortConfirmBtn: { backgroundColor: '#FF5722', paddingVertical: 15, borderRadius: 25, flex: 1, elevation: 3 },
  abortConfirmBtnDisabled: { backgroundColor: '#999' },
  abortBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18, textAlign: 'center' },
};
