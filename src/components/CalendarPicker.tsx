import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { layout, palette, type } from '@/theme/theme';
import { PressFeedback } from '@/components/ui';

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
      <PressFeedback baseColor={palette.surface} onPress={() => setOpen((v) => !v)} style={styles.trigger}>
        <Feather name="calendar" size={16} color={palette.link} />
        <Text style={[type.body, styles.triggerText]}>{triggerLabel}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={palette.textMuted} />
      </PressFeedback>

      {/* §9: no shadows outside modals — this dropdown is the one permitted exception, a floating overlay. */}
      {open && (
        <View style={styles.calendar}>
          <View style={styles.calHeader}>
            <Text style={type.bodyBold}>{monthLabel}</Text>
            <View style={styles.navRow}>
              <PressFeedback baseColor="transparent" onPress={prevMonth} style={styles.navBtn}>
                <Feather name="chevron-left" size={18} color={palette.textPrimary} />
              </PressFeedback>
              <PressFeedback baseColor="transparent" onPress={nextMonth} style={styles.navBtn}>
                <Feather name="chevron-right" size={18} color={palette.textPrimary} />
              </PressFeedback>
            </View>
          </View>

          <View style={styles.weekRow}>
            {WEEK_DAYS.map((d, i) => (
              <Text key={i} style={[type.caption, styles.weekLabel]}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((date, i) => {
              const isCurrentMonth = date.getMonth() === viewMonth;
              const isSel = sameDay(date, selected);
              const isTod = sameDay(date, today);
              const isDisabled = maxDate ? date > maxDate : false;

              return (
                <PressFeedback
                  key={i}
                  baseColor="transparent"
                  pressedColor={palette.surfaceRaised}
                  onPress={() => selectDate(date)}
                  disabled={isDisabled}
                  style={[styles.cell, isSel && styles.cellSelected]}
                >
                  <Text
                    style={[
                      type.body,
                      { color: isCurrentMonth ? palette.textPrimary : palette.textMuted },
                      isSel && styles.cellTextSelected,
                      isTod && !isSel && styles.cellTextToday,
                      isDisabled && styles.cellTextDisabled,
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                  {isTod && !isSel && <View style={styles.todayDot} />}
                </PressFeedback>
              );
            })}
          </View>

          <View style={styles.calFooter}>
            <PressFeedback baseColor="transparent" onPress={selectToday} style={styles.todayBtnWrap}>
              <Text style={styles.todayBtn}>Today</Text>
            </PressFeedback>
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
    gap: layout.gapSm,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: layout.radiusContainer,
    paddingHorizontal: layout.gapMd,
    height: 48,
  },
  triggerText: {
    flex: 1,
  },
  calendar: {
    marginTop: layout.gapSm,
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: layout.radiusHero,
    padding: layout.gapMd,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 24px rgba(0,0,0,0.36)',
      },
      default: {
        shadowColor: palette.canvas,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.36,
        shadowRadius: 16,
        elevation: 8,
      },
    }),
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: layout.gapMd,
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
    borderRadius: 20,
  },
  cellSelected: {
    backgroundColor: palette.link,
  },
  cellTextSelected: {
    color: palette.canvas,
    fontFamily: type.bodyBold.fontFamily,
  },
  cellTextToday: {
    color: palette.link,
    fontFamily: type.bodyBold.fontFamily,
  },
  cellTextDisabled: {
    color: palette.textMuted,
    opacity: 0.5,
  },
  todayDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.link,
  },
  calFooter: {
    borderTopWidth: 1,
    borderTopColor: palette.hairline,
    marginTop: layout.gapSm,
    paddingTop: layout.gapMd,
  },
  todayBtnWrap: {
    alignSelf: 'flex-start',
  },
  todayBtn: {
    fontSize: type.body.fontSize,
    fontFamily: type.bodyBold.fontFamily,
    color: palette.link,
  },
});
