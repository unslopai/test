#include <stdio.h>
#include <string.h>

// Diese Funktion simuliert die Verarbeitung von Nutzereingaben in eurer App
void process_payload(const char *user_input, int payload_length)
{
    // Fester Puffer mit einer Größe von 64 Bytes
    char local_buffer[64];

    // SEC-002 Trigger:
    // Die Schleife nutzt 'payload_length' als Obergrenze für den Index 'i'.
    // Es fehlt eine vorherige Prüfung (z.B. if (payload_length >= 64) return;).
    // Da die Obergrenze im aktuellen Scope nicht verifiziert wurde,
    // führt dies zu einem klassischen Buffer Overflow, wenn payload_length > 64 ist.
    for (int i = 0; i < payload_length; i++)
    {
        local_buffer[i] = user_input[i];
    }

    // Weitere Verarbeitung...
    printf("Payload processed. First char: %c\n", local_buffer[0]);
}

int main()
{
    // Simulierter böswilliger Input, der größer als 64 Bytes ist
    char malicious_input[100];
    memset(malicious_input, 'A', 99);
    malicious_input[99] = '\0';

    // Aufruf der unsicheren Funktion
    process_payload(malicious_input, 100);

    return 0;
}