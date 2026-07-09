import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface Props {
  value: Date;
  onChange: (date: Date) => void;
  maximumDate?: Date;
}

const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function CalendarPicker({ value, onChange, maximumDate }: Props) {
  const colors = useColors();

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth());

  const today = startOfDay(new Date());
  const selected = startOfDay(value);
  const maxDate = maximumDate ? startOfDay(maximumDate) : undefined;

  // build the 42-cell (6-row) grid
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const cells: Date[] = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    cells.push(new Date(viewYear, viewMonth - 1, prevMonthDays - i));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(viewYear, viewMonth, d));
  }
  while (cells.length < 42) {
    cells.push(new Date(viewYear, viewMonth + 1, cells.length - firstWeekday - daysInMonth + 1));
  }

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const triggerLabel = value.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const selectDate = (date: Date) => {
    if (maxDate && date > maxDate) return;
    onChange(date);
    setOpen(false);
  };

  const selectToday = () => {
    onChange(today);
    setOpen(false);
  };

  return (
    <View>
      {/* Trigger button */}
      <TouchableOpacity
        style={[styles.trigger, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.8}
      >
        <Feather name="calendar" size={16} color={colors.primary} />
        <Text style={[styles.triggerText, { color: colors.foreground }]}>{triggerLabel}</Text>
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.mutedForeground}
        />
      </TouchableOpacity>

      {/* Calendar dropdown */}
      {open && (
        <View
          style={[
            styles.calendar,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              shadowColor: '#000',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.calHeader}>
            <Text style={[styles.calMonthTitle, { color: colors.foreground }]}>{monthLabel}</Text>
            <View style={styles.navRow}>
              <TouchableOpacity onPress={prevMonth} style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="chevron-left" size={18} color={colors.foreground} />
              </TouchableOpacity>
              <TouchableOpacity onPress={nextMonth} style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="chevron-right" size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Day-of-week labels */}
          <View style={styles.weekRow}>
            {WEEK_DAYS.map((d, i) => (
              <Text key={i} style={[styles.weekLabel, { color: colors.mutedForeground }]}>
                {d}
              </Text>
            ))}
          </View>

          {/* Day grid — 6 rows × 7 cols */}
          <View style={styles.grid}>
            {cells.map((date, i) => {
              const isCurrentMonth = date.getMonth() === viewMonth;
              const isSel = sameDay(date, selected);
              const isTod = sameDay(date, today);
              const isDisabled = maxDate ? date > maxDate : false;

              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.cell,
                    isSel && { backgroundColor: colors.primary, borderRadius: 20 },
                  ]}
                  onPress={() => selectDate(date)}
                  disabled={isDisabled}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.cellText,
                      { color: isCurrentMonth ? colors.foreground : colors.mutedForeground + '55' },
                      isSel && { color: '#fff', fontFamily: 'Inter_700Bold' },
                      isTod && !isSel && { color: colors.primary, fontFamily: 'Inter_600SemiBold' },
                      isDisabled && { color: colors.mutedForeground + '44' },
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                  {/* dot for today when not selected */}
                  {isTod && !isSel && (
                    <View style={[styles.todayDot, { backgroundColor: colors.primary }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Footer */}
          <View style={[styles.calFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity onPress={selectToday}>
              <Text style={[styles.todayBtn, { color: colors.primary }]}>Today</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  triggerText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  calendar: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
      },
    }),
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calMonthTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  navRow: {
    flexDirection: 'row',
    gap: 4,
  },
  navBtn: {
    padding: 4,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%` as any,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  todayDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  calFooter: {
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 10,
  },
  todayBtn: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
