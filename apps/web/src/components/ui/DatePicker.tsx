"use client";

import React, { useState, useEffect, useRef } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations, formatTranslation } from "@/lib/i18n";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  includeTime?: boolean;
  minDate?: string;
  className?: string;
}

export default function DatePicker({
  value,
  onChange,
  label,
  placeholder,
  includeTime = false,
  minDate,
  className = "",
}: DatePickerProps) {
  const tCommon = useTranslations("common");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const placeholderText = placeholder ?? tCommon("datePicker.placeholder");

  // Parse initial value or default to today
  const parseDate = (val: string) => {
    if (!val) return new Date();
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const [viewDate, setViewDate] = useState(() => parseDate(value)); // For calendar navigation
  const [selectedDate, setSelectedDate] = useState<Date | null>(() =>
    value ? parseDate(value) : null
  );

  // Time state
  const [time, setTime] = useState(() => {
    if (!value) return "00:00";
    const d = parseDate(value);
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  });

  useEffect(() => {
    if (value) {
      const d = parseDate(value);
      setSelectedDate(d);
      setViewDate(d);
      const h = d.getHours().toString().padStart(2, "0");
      const m = d.getMinutes().toString().padStart(2, "0");
      setTime(`${h}:${m}`);
    }
  }, [value]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Calendar logic
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDateClick = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);

    // Preserve time if time is already selected or default to current time
    let [hours, minutes] = time.split(":").map(Number);

    // If selecting today, ensure time is not in the past
    const now = new Date();
    if (
      newDate.getFullYear() === now.getFullYear() &&
      newDate.getMonth() === now.getMonth() &&
      newDate.getDate() === now.getDate()
    ) {
      const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
      const selectedTotalMinutes = hours * 60 + minutes;

      if (selectedTotalMinutes < currentTotalMinutes) {
        hours = now.getHours();
        minutes = now.getMinutes() + 1; // At least 1 minute in the future
        if (minutes >= 60) {
          minutes = 0;
          hours = (hours + 1) % 24;
        }
        setTime(`${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`);
      }
    }

    newDate.setHours(hours || 0);
    newDate.setMinutes(minutes || 0);

    setSelectedDate(newDate);

    // Format output
    emitChange(newDate);

    if (!includeTime) {
      setIsOpen(false);
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;

    if (selectedDate) {
      const [h, m] = newTime.split(":").map(Number);
      const newDate = new Date(selectedDate);
      newDate.setHours(h);
      newDate.setMinutes(m);

      // If today, don't allow past time
      const now = new Date();
      if (
        newDate.getFullYear() === now.getFullYear() &&
        newDate.getMonth() === now.getMonth() &&
        newDate.getDate() === now.getDate()
      ) {
        if (newDate < now) {
          // If past time is selected on today, reset to current time or don't allow
          const currentH = now.getHours().toString().padStart(2, "0");
          const currentM = (now.getMinutes() + 1).toString().padStart(2, "0");
          setTime(`${currentH}:${currentM}`);
          return;
        }
      }

      setTime(newTime);
      setSelectedDate(newDate);
      emitChange(newDate);
    } else {
      setTime(newTime);
    }
  };

  const emitChange = (date: Date) => {
    // Format to ISO string or YYYY-MM-DD based on includeTime
    // But local ISO format is better for datetime-local: YYYY-MM-DDTHH:mm
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const d = date.getDate().toString().padStart(2, "0");

    if (includeTime) {
      const h = date.getHours().toString().padStart(2, "0");
      const min = date.getMinutes().toString().padStart(2, "0");
      onChange(`${y}-${m}-${d}T${h}:${min}`);
    } else {
      onChange(`${y}-${m}-${d}`);
    }
  };

  const daysInMonth = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());
  const firstDay = getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  const monthNames = Array.from({ length: 12 }, (_, index) =>
    tCommon(`datePicker.monthNames.${index}`)
  );

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === viewDate.getMonth() &&
      selectedDate.getFullYear() === viewDate.getFullYear()
    );
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === viewDate.getMonth() &&
      today.getFullYear() === viewDate.getFullYear()
    );
  };

  const isDisabled = (day: number) => {
    const dateToCompare = new Date(viewDate.getFullYear(), viewDate.getMonth(), day, 23, 59, 59);
    const now = new Date();

    if (minDate) {
      const min = new Date(minDate);
      return dateToCompare < min;
    }

    // Default: cannot select dates before today
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return dateToCompare < today;
  };

  const formatDisplay = () => {
    if (!value) return "";
    const d = parseDate(value);
    const params = {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour: d.getHours().toString().padStart(2, "0"),
      minute: d.getMinutes().toString().padStart(2, "0"),
    };
    if (includeTime) {
      return formatTranslation(tCommon("datePicker.displayWithTime"), params);
    }
    return formatTranslation(tCommon("datePicker.displayDate"), params);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="text-sm font-bold text-gray-700 ml-1 mb-1 block">{label}</label>}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 rounded-xl bg-white border border-gray-200 flex items-center justify-between cursor-pointer transition-all hover:border-purple-300 hover:shadow-md ${
          isOpen ? "ring-2 ring-purple-100 border-purple-400" : ""
        }`}
      >
        <div className="flex items-center gap-3 text-gray-700">
          <div
            className={`p-1.5 rounded-lg ${value ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-400"}`}
          >
            <CalendarIcon className="w-4 h-4" data-testid="calendar-icon" />
          </div>
          <span className={`font-medium ${!value ? "text-gray-400" : "text-gray-900"}`}>
            {value ? formatDisplay() : placeholderText}
          </span>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 mt-2 w-[320px] bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="font-bold text-gray-800">
                {formatTranslation(tCommon("datePicker.header"), {
                  year: viewDate.getFullYear(),
                  month: monthNames[viewDate.getMonth()],
                })}
              </div>
              <button
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 mb-2">
              {Array.from({ length: 7 }, (_, index) => (
                <div key={index} className="text-center text-xs font-medium text-gray-400 py-1">
                  {tCommon(`datePicker.weekdayNames.${index}`)}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 mb-4">
              {blanks.map((i) => (
                <div key={`blank-${i}`} className="h-9" />
              ))}
              {days.map((day) => {
                const selected = isSelected(day);
                const today = isToday(day);
                const disabled = isDisabled(day);
                return (
                  <button
                    key={day}
                    onClick={() => !disabled && handleDateClick(day)}
                    disabled={disabled}
                    className={`h-9 w-9 rounded-xl text-sm font-medium flex items-center justify-center transition-all ${
                      disabled
                        ? "text-gray-300 cursor-not-allowed bg-gray-50/50"
                        : selected
                          ? "bg-purple-600 text-white shadow-lg shadow-purple-200"
                          : today
                            ? "bg-purple-50 text-purple-600 font-bold"
                            : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Time Picker */}
            {includeTime && (
              <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                  <Clock className="w-4 h-4 text-purple-500" />
                  <span>{tCommon("datePicker.timeLabel")}</span>
                </div>
                <input
                  type="time"
                  value={time}
                  onChange={handleTimeChange}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-purple-100 focus:border-purple-400 outline-none"
                />
              </div>
            )}

            {/* Action Bar */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs font-bold text-purple-600 hover:bg-purple-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                {tCommon("datePicker.confirm")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
