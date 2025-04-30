import { Signal } from '@preact/signals';

import { Status } from '~common/common';
import { BLUE_COLOR, RED_COLOR } from '~common/webview';

interface Props {
    data: Signal<string>;
    status: Status;
    id: number;
    onView: (id: number) => void;
    onAdd: (id: number) => void;
}

const from = ['Generator', 'Solution', 'Good Solution'];

export default function ({ data, status, id, onView, onAdd }: Props) {
  const statusItem = (() => {
    if (status === Status.WA)
      return <p class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }}>WA</p>;
    else if (status === Status.CE)
      return <p class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }}>CE</p>;
    else if (status === Status.RE)
      return <p class="text-base leading-tight px-3 w-fit display-font" style={{ backgroundColor: RED_COLOR }}>RE</p>;
    return <></>;
  })();

  switch (status) {
  case Status.COMPILING:
    return <div class="container mx-auto mb-6">
      <div class="flex flex-row">
        <div class="w-6 shrink-0"></div>
        <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
          <p class="text-base leading-tight bg-zinc-600 px-3 w-fit display-font">{from[id]}</p>
          <p class="text-base leading-tight bg-zinc-600 px-3 w-fit display-font">compiling</p>
        </div>
      </div>
    </div>;
  case Status.RUNNING:
    return <div class="container mx-auto mb-6">
      <div class="flex flex-row">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1 shrink-0">
          <path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
        </svg>
        <div class="grow">
          <p class="text-base leading-tight bg-zinc-600 px-3 w-fit display-font">{from[id]}</p>
          <pre class="text-base display-font">{data}</pre>
        </div>
      </div></div>;
  default:
    return <div class="container mx-auto mb-6">
      <div class="flex flex-row">
        <div class="w-6 shrink-0"></div>
        <div class="flex justify-start gap-x-2 bg-zinc-800 grow">
          <p class="text-base leading-tight bg-zinc-600 px-3 w-fit display-font">{from[id]}</p>
          {statusItem}
          {(status === Status.RE || status === Status.WA) &&
                            <button class="text-base leading-tight px-3 w-fit display-font" style={{ background: BLUE_COLOR }} onClick={() => onAdd(id)}>add testcase</button>}
        </div>
      </div>
      <div class="flex flex-row">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 mr-2 mt-1 shrink-0" onClick={() => onView(id)}>
          <path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
        </svg>
        <pre class="text-base display-font">{data}</pre>
      </div>
    </div>;
  }
}